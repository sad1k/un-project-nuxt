/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const authSource = await readFile("lib/auth.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("auth config accepts additional trusted origins for local device testing", () => {
  assert.match(envSource, /BETTER_AUTH_TRUSTED_ORIGINS:\s*z\.string\(\)\.optional\(\)/);
  assert.match(authSource, /BETTER_AUTH_TRUSTED_ORIGINS\?\.split\(","\)/);
  assert.match(authSource, /trustedOrigins/);
  assert.match(authSource, /env\.BETTER_AUTH_URL/);
});
