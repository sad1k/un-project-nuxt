/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const signInPageSource = await readFile("pages/sign-in.vue", "utf8");

test("sign-in providers reset pending state after authorization errors", () => {
  assert.match(signInPageSource, /try\s*\x7B/);
  assert.match(signInPageSource, /catch\s*(?:\(|\x7B)/);
  assert.match(signInPageSource, /finally\s*\x7B/);
  assert.match(signInPageSource, /isSigningIn\.value\s*=\s*false/);
  assert.match(signInPageSource, /activeProvider\.value\s*=\s*null/);
});

test("sign-in page shows an authorization error notification", () => {
  assert.match(signInPageSource, /authError/);
  assert.match(signInPageSource, /role="alert"/);
  assert.match(signInPageSource, /aria-live="assertive"/);
});
