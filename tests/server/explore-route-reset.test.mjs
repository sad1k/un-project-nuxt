/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");
const resultsActionsSource = await readFile("components/explore/results-actions.vue", "utf8");

test("route session can abort an in-flight generation when reset", () => {
  assert.match(sessionSource, /activeStreamController/);
  assert.match(sessionSource, /new AbortController\(\)/);
  assert.match(sessionSource, /signal: controller\.signal/);
  // Reset must abort so the stream cannot repopulate cleared state.
  assert.match(sessionSource, /activeStreamController\?\.abort\(\)/);
  // A user cancel is not surfaced as a generation failure.
  assert.match(sessionSource, /if \(!controller\.signal\.aborted\)/);
});

test("results actions expose a destructive reset control", () => {
  assert.match(resultsActionsSource, /function confirmReset/);
  assert.match(resultsActionsSource, /resetRouteSession\(\)/);
  assert.match(resultsActionsSource, /Удалить маршрут/);
  assert.match(resultsActionsSource, /toggle\(["']reset["']\)/);
  // Clearing also drops the shareable sessionId from the URL.
  assert.match(resultsActionsSource, /delete nextQuery\.sessionId/);
});
