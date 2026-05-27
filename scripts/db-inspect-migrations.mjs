/* eslint-disable no-console, node/no-process-env */
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path))
    return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#"))
      continue;
    const eq = line.indexOf("=");
    if (eq === -1)
      continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!(k in process.env))
      process.env[k] = v;
  }
}
loadEnvFile(".env");

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const rows = (await client.execute("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id")).rows;
console.log("=== __drizzle_migrations in production ===");
for (const r of rows) console.log(`id=${r.id}  hash=${r.hash}  created_at=${r.created_at}`);

console.log("\n=== current local migration files ===");
const journal = JSON.parse(await readFile("lib/db/migrations/meta/_journal.json", "utf8"));
for (const e of journal.entries) {
  const sql = await readFile(join("lib/db/migrations", `${e.tag}.sql`), "utf8");
  const h = createHash("sha256").update(sql).digest("hex");
  console.log(`${e.tag}  hash=${h}  when=${e.when}`);
}

console.log("\n=== sanity: tables present in DB ===");
const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
console.log(tables.map(r => r.name).join("\n"));

client.close();
