/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const authSchemaSource = await readFile("lib/db/schema/auth.ts", "utf8");
const adminHandlerSource = await readFile("utils/define-admin-handler.ts", "utf8");
const authProfileSource = await readFile("server/api/auth/profile.get.ts", "utf8");
const authStoreSource = await readFile("stores/auth.ts", "utf8");
const phaseContextSource = await readFile(".planning/phases/09-admin-route-generation-observability-and-improvement-loop/09-CONTEXT.md", "utf8");

test("user schema persists a narrow admin role with a safe default", () => {
  assert.match(authSchemaSource, /export type UserRole = "user" \| "admin"/);
  assert.match(authSchemaSource, /role:\s*text\(\{\s*enum:\s*\["user",\s*"admin"\]\s*\}\)\.notNull\(\)\.default\("user"\)/);
  assert.match(authSchemaSource, /role\?: UserRole/);
});

test("admin handler uses authenticated sessions and persisted admin role checks", () => {
  assert.match(adminHandlerSource, /defineAuthenticatedHandler/);
  assert.match(adminHandlerSource, /role === "admin"/);
  assert.match(adminHandlerSource, /db\.query\.user\.findFirst/);
  assert.match(adminHandlerSource, /eq\(user\.id,\s*currentUser\.id\)/);
  assert.match(adminHandlerSource, /statusCode:\s*403/);
  assert.doesNotMatch(adminHandlerSource, /process\.env/);
});

test("client auth profile refresh reads persisted role without trusting session extras", () => {
  assert.match(authProfileSource, /defineAuthenticatedHandler/);
  assert.match(authProfileSource, /db\.query\.user\.findFirst/);
  assert.match(authProfileSource, /role:\s*true/);
  assert.match(authStoreSource, /\/api\/auth\/profile/);
  assert.match(authStoreSource, /persistedRole/);
  assert.match(authStoreSource, /role:\s*persistedRole\.value \?\? sessionUser\.role/);
});

test("phase 9 keeps role management UI out of scope", () => {
  assert.match(phaseContextSource, /Phase 9 must not add UI for managing user roles/);
  assert.match(phaseContextSource, /Assigning the first `admin` role in v1 is done manually/);
});
