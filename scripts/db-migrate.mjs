// Resilient Drizzle migrator for Turso/libSQL.
// Applies each statement individually with retries — survives flaky TLS
// connections that break long hrana batches (ECONNRESET, fetch failed).
// Records every applied migration in __drizzle_migrations so drizzle-kit
// keeps treating them as applied.

/* eslint-disable no-console, node/no-process-env */
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Minimal .env loader — avoids dotenv dependency.
function loadEnvFile(path) {
  if (!existsSync(path))
    return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#"))
      continue;
    const eq = line.indexOf("=");
    if (eq === -1)
      continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env))
      process.env[key] = val;
  }
}
loadEnvFile(".env");

const MIGRATIONS_DIR = "lib/db/migrations";
const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1500;

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

function isRetryable(err) {
  if (!err)
    return false;
  const code = err.code || err.cause?.code;
  const msg = `${err.message || ""} ${err.cause?.message || ""}`.toLowerCase();
  return (
    RETRYABLE_CODES.has(code)
    || msg.includes("fetch failed")
    || msg.includes("socket hang up")
    || msg.includes("network")
  );
}

async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    }
    catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS)
        throw err;
      const wait = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      console.warn(`  retry ${attempt}/${MAX_ATTEMPTS - 1} for ${label}: ${err.code || err.message} — waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function splitStatements(sql) {
  return sql
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !/^\s*--/.test(s));
}

// Make DDL idempotent so a retry of a partially-completed statement does
// not fail on "already exists" — fetch can drop the response after the
// server has already applied the change.
function idempotentize(stmt) {
  let s = stmt;
  s = s.replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE TABLE IF NOT EXISTS ");
  s = s.replace(/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  s = s.replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE INDEX IF NOT EXISTS ");
  return s;
}

// SQLite has no "ALTER TABLE ADD COLUMN IF NOT EXISTS" — swallow the
// specific "duplicate column name" error on retry of an ALTER.
function isDuplicateColumnError(err) {
  const msg = `${err?.message || ""} ${err?.cause?.message || ""}`.toLowerCase();
  return msg.includes("duplicate column name");
}

function hashSql(sql) {
  // Drizzle hashes the raw SQL contents.
  return createHash("sha256").update(sql).digest("hex");
}

async function loadJournal() {
  const raw = await readFile(join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8");
  return JSON.parse(raw);
}

async function loadMigrationFile(tag) {
  const files = await readdir(MIGRATIONS_DIR);
  const file = files.find(f => f.startsWith(`${tag}`) && f.endsWith(".sql"));
  if (!file)
    throw new Error(`Migration file not found for tag ${tag}`);
  return readFile(join(MIGRATIONS_DIR, file), "utf8");
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url)
    throw new Error("TURSO_DATABASE_URL is required");

  console.log(`Connecting to ${url}`);
  const client = createClient({ url, authToken });

  console.log("Ensuring __drizzle_migrations table exists");
  await withRetry("create __drizzle_migrations", () => client.execute(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
    + "hash TEXT NOT NULL, "
    + "created_at INTEGER"
    + ")",
  ));

  // Use rowid: the legacy __drizzle_migrations table on this DB was created
  // with PG syntax (id SERIAL PRIMARY KEY), so the id column is always NULL
  // on SQLite. rowid is always present and stable in insertion order.
  const applied = await withRetry("read __drizzle_migrations", () => client.execute(
    "SELECT rowid AS rid, hash, created_at FROM __drizzle_migrations ORDER BY rowid ASC",
  ));
  console.log(`Already recorded in __drizzle_migrations: ${applied.rows.length}`);

  const journal = await loadJournal();
  const local = [];
  for (const entry of journal.entries) {
    const sql = await loadMigrationFile(entry.tag);
    local.push({ entry, sql, hash: hashSql(sql) });
  }

  // Repair phase: if a recorded migration's hash drifted from its local file
  // (e.g. drizzle-kit was re-generated after the migration ran), update the
  // hash in place. Trusted because physical tables are already present.
  for (let i = 0; i < applied.rows.length; i++) {
    const dbRow = applied.rows[i];
    const localItem = local[i];
    if (!localItem) {
      throw new Error(`DB has migration record at position ${i} but no local file exists. Refusing to continue.`);
    }
    if (String(dbRow.hash) === localItem.hash) {
      console.log(`OK   [${i}] ${localItem.entry.tag}`);
      continue;
    }
    console.log(`FIX  [${i}] ${localItem.entry.tag}`);
    console.log(`       old hash: ${dbRow.hash}`);
    console.log(`       new hash: ${localItem.hash}`);
    await withRetry(`update hash for ${localItem.entry.tag}`, () => client.execute({
      sql: "UPDATE __drizzle_migrations SET hash = ?, created_at = ? WHERE rowid = ?",
      args: [localItem.hash, localItem.entry.when, dbRow.rid],
    }));
  }

  // Apply phase: only files past what's already recorded.
  for (let i = applied.rows.length; i < local.length; i++) {
    const { entry, sql, hash } = local[i];
    console.log(`\nAPPLY ${entry.tag}`);
    const statements = splitStatements(sql);
    console.log(`  ${statements.length} statements`);

    for (let j = 0; j < statements.length; j++) {
      const stmt = idempotentize(statements[j]);
      const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
      console.log(`  [${j + 1}/${statements.length}] ${preview}${stmt.length > 80 ? "..." : ""}`);
      try {
        await withRetry(`stmt ${j + 1}`, () => client.execute(stmt));
      }
      catch (err) {
        if (isDuplicateColumnError(err) && /^ALTER\s+TABLE/i.test(stmt)) {
          console.log("     (column already exists — skipping)");
          continue;
        }
        throw err;
      }
    }

    await withRetry("record migration", () => client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [hash, entry.when],
    }));
    console.log(`  recorded ${entry.tag}`);
  }

  console.log("\nAll migrations applied.");
  client.close();
}

main().catch((err) => {
  console.error("\nMigration failed:");
  console.error(err);
  if (err.cause)
    console.error("Cause:", err.cause);
  process.exit(1);
});
