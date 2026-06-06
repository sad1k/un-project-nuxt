/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const layoutSource = await readFile("layouts/default.vue", "utf8");
const pluginSource = await readFile("plugins/request-error-notifications.client.ts", "utf8");

test("default layout no longer mounts global request error notification toasts", () => {
  assert.doesNotMatch(layoutSource, /<AppRequestErrorNotifications\s*\/>/);
});

test("third-party / cross-origin failures never raise a request-error toast", () => {
  // Mapbox telemetry (events.mapbox.com) and other cross-origin requests fail
  // for reasons outside the app's control; their failures must be ignored so
  // they don't spam the user with "Запрос не выполнен" toasts.
  assert.match(pluginSource, /url\.origin !== window\.location\.origin\)\s+return false;/);
  // The cross-origin guard must run before the method check so a failed
  // third-party POST (telemetry) is dropped instead of always notifying.
  const originIndex = pluginSource.indexOf("url.origin !== window.location.origin");
  const methodIndex = pluginSource.indexOf("normalizeMethod(options?.method");
  assert.ok(originIndex > -1 && originIndex < methodIndex, "cross-origin guard must precede the method check");
});

test("best-effort enrichment endpoints are excluded from request-error toasts", () => {
  // Place photos / intelligence / stories / weather tips proxy third-party
  // providers and degrade gracefully in the UI, so their failures are noise.
  assert.match(pluginSource, /function isBestEffortRequest/);
  assert.match(pluginSource, /\/api\/explore\/place-photo/);
  assert.match(pluginSource, /\/api\/explore\/place-intelligence/);
  assert.match(pluginSource, /\/api\/explore\/place-story/);
  assert.match(pluginSource, /\/api\/explore\/weather-tips/);
});
