/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaSource = await readFile("lib/db/schema/ai-route.ts", "utf8");
const querySource = await readFile("lib/db/queries/ai-route.ts", "utf8");

test("AI route schema defines user-owned sessions, variants, points, messages, and events", () => {
  for (const tableName of [
    "aiRouteSession",
    "aiRouteMessage",
    "aiRouteVariant",
    "aiRoutePoint",
    "aiRouteEvent",
  ]) {
    assert.match(schemaSource, new RegExp(`export const ${tableName}`));
  }

  assert.match(schemaSource, /userId/g);
  assert.match(schemaSource, /lat: real\(\)\.notNull\(\)/);
  assert.match(schemaSource, /long: real\(\)\.notNull\(\)/);
  assert.match(schemaSource, /approximateDistanceMeters/);
});

test("route persistence helpers expose the expected ownership-safe API", () => {
  for (const helperName of [
    "createAiRouteSession",
    "appendAiRouteMessage",
    "createAiRouteVariant",
    "persistAiRoutePoint",
    "persistAiRouteEvent",
    "markAiRouteVariantCompleted",
    "markAiRouteVariantFailed",
    "findAiRouteSessionsByUserId",
    "findAiRouteSessionByIdForUser",
  ]) {
    assert.match(querySource, new RegExp(`export async function ${helperName}`));
  }
});

test("route persistence reads and writes are scoped to authenticated user ids", () => {
  assert.match(querySource, /userId: number/g);
  assert.match(querySource, /eq\(aiRouteSession\.userId, userId\)/);
  assert.match(querySource, /eq\(aiRouteVariant\.userId, userId\)/);
  assert.match(querySource, /userId,/);
  assert.doesNotMatch(querySource, /browserUserId/);
});

test("route persistence does not log secrets, provider headers, or env state", () => {
  assert.doesNotMatch(querySource, /console\./);
  assert.doesNotMatch(querySource, /process\.env/);
  assert.doesNotMatch(querySource, /Authorization/);
  assert.doesNotMatch(querySource, /\.env/);
});
