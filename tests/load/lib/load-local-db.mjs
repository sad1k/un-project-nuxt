/* eslint-disable node/no-process-env */

import { createClient } from "@libsql/client";

export function resolveLocalDatabaseUrl() {
  return process.env.LOAD_DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:local.db";
}

export function assertLocalDatabaseUrl(url, { allowNonLocal = false } = {}) {
  const localPatterns = [
    /^file:/,
    /^http:\/\/127\.0\.0\.1(?::\d+)?\//,
    /^http:\/\/localhost(?::\d+)?\//,
  ];

  if (allowNonLocal || localPatterns.some(pattern => pattern.test(url)))
    return;

  throw new Error(`Refusing load seed/cleanup against non-local database URL: ${url}. Set LOAD_ALLOW_NON_LOCAL_DB=1 to override.`);
}

export function createLoadDbClient(options = {}) {
  const url = options.url || resolveLocalDatabaseUrl();
  assertLocalDatabaseUrl(url, {
    allowNonLocal: options.allowNonLocal ?? isEnabled(process.env.LOAD_ALLOW_NON_LOCAL_DB),
  });

  return createClient({
    authToken: process.env.LOAD_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
    url,
  });
}

export async function insertLoadUser(client, { email, name, now = Date.now() }) {
  const result = await client.execute({
    args: [name, email, 1, null, "user", now, now],
    sql: `
      INSERT INTO "user" (name, email, emailVerified, image, role, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
  });

  return Number(result.rows[0].id);
}

export async function insertLoadSession(client, {
  expiresAt = Date.now() + 1000 * 60 * 60 * 24,
  now = Date.now(),
  token,
  userId,
}) {
  const result = await client.execute({
    args: [expiresAt, token, now, now, "load-runner", "WanderLog load runner", userId],
    sql: `
      INSERT INTO "session" (expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
  });

  return Number(result.rows[0].id);
}

export async function findRunMarkedRows(client, runId) {
  const pattern = `%${runId}%`;
  const users = await client.execute({
    args: [pattern, pattern],
    sql: `SELECT id, email, name FROM "user" WHERE email LIKE ? OR name LIKE ?`,
  });

  return {
    userIds: users.rows.map(row => Number(row.id)),
    users: users.rows,
  };
}

export async function deleteRunMarkedRows(client, runId) {
  const { userIds } = await findRunMarkedRows(client, runId);

  if (userIds.length === 0) {
    return {
      locationImages: 0,
      locationLogs: 0,
      locations: 0,
      posts: 0,
      sessions: 0,
      users: 0,
    };
  }

  const placeholders = userIds.map(() => "?").join(", ");
  const deleted = {};

  deleted.posts = await deleteCount(client, `DELETE FROM post WHERE userId IN (${placeholders})`, userIds);
  deleted.locationImages = await deleteCount(client, `DELETE FROM locationLogImage WHERE userId IN (${placeholders})`, userIds);
  deleted.locationLogs = await deleteCount(client, `DELETE FROM locationLog WHERE userId IN (${placeholders})`, userIds);
  deleted.locations = await deleteCount(client, `DELETE FROM location WHERE userId IN (${placeholders})`, userIds);
  deleted.sessions = await deleteCount(client, `DELETE FROM "session" WHERE userId IN (${placeholders})`, userIds);
  deleted.users = await deleteCount(client, `DELETE FROM "user" WHERE id IN (${placeholders})`, userIds);

  return deleted;
}

async function deleteCount(client, sql, args) {
  const result = await client.execute({ args, sql });
  return Number(result.rowsAffected ?? 0);
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}
