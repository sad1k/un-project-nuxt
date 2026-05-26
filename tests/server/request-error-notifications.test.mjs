/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const layoutSource = await readFile("layouts/default.vue", "utf8");

test("default layout no longer mounts global request error notification toasts", () => {
  assert.doesNotMatch(layoutSource, /<AppRequestErrorNotifications\s*\/>/);
});
