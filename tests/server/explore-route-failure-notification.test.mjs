/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");
const exploreSource = await readFile("pages/explore.vue", "utf8");
const pluginSource = await readFile("plugins/request-error-notifications.client.ts", "utf8");

test("route session surfaces a toast on generation failure", () => {
  assert.match(sessionSource, /import \{ toast \} from "vue-sonner"/);
  assert.match(sessionSource, /function notifyRouteFailure/);
  assert.match(sessionSource, /toast\.error\("Не удалось сгенерировать маршрут"/);
});

test("both failure paths notify the user", () => {
  // The streamed route.failed event arrives over a 200 OK response, so it must
  // notify explicitly rather than relying on the transport-level fetch wrapper.
  const failedHandler = sessionSource.slice(sessionSource.indexOf("route.failed"));
  assert.match(failedHandler, /notifyRouteFailure\(event\.message\)/);
  // A transport-level failure (non-aborted) also notifies.
  const catchBlock = sessionSource.slice(sessionSource.indexOf("Route stream failed"));
  assert.match(catchBlock, /notifyRouteFailure\(/);
});

test("a user-cancelled generation is not reported as a failure", () => {
  // notifyRouteFailure on the transport path stays inside the !aborted guard.
  const guardIndex = sessionSource.indexOf("if (!controller.signal.aborted)");
  const finallyIndex = sessionSource.indexOf("finally", guardIndex);
  const guardedBlock = sessionSource.slice(guardIndex, finallyIndex);
  assert.match(guardedBlock, /notifyRouteFailure\(/);
});

test("explore page mounts the toaster so failure toasts can render", () => {
  // /explore opts out of the default layout, so it must mount the toaster itself.
  assert.match(exploreSource, /layout: false/);
  assert.match(exploreSource, /<AppRequestErrorNotifications\s*\/>/);
});

test("request-error plugin defers route stream failures to the tailored toast", () => {
  assert.match(pluginSource, /function isRouteStreamRequest/);
  assert.match(pluginSource, /url\.pathname === "\/api\/ai\/route"/);
  // The exclusion runs before the generic notifier decides to fire.
  const guardIndex = pluginSource.indexOf("if (isRouteStreamRequest(request))");
  const methodIndex = pluginSource.indexOf("normalizeMethod(options?.method");
  assert.ok(guardIndex > -1 && guardIndex < methodIndex, "route exclusion must precede the generic method check");
});
