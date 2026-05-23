/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const serviceWorkerSource = await readFile("public/wanderlog-sw.js", "utf8");
const legacyWorkerSource = await readFile("public/route-generation-sw.js", "utf8");
const notificationSource = await readFile("composables/use-route-generation-notifications.ts", "utf8");
const offlineSource = await readFile("public/offline.html", "utf8");

test("unified app service worker owns shell lifecycle notifications and navigation fallback", () => {
  for (const eventName of ["install", "activate", "fetch", "push", "notificationclick"])
    assert.match(serviceWorkerSource, new RegExp(`addEventListener\\("${eventName}"`));

  assert.match(serviceWorkerSource, /wanderlog-app-shell-v1/);
  assert.match(serviceWorkerSource, /\/offline\.html/);
  assert.match(serviceWorkerSource, /request\.mode !== "navigate"/);
  assert.match(serviceWorkerSource, /showNotification/);
  assert.match(serviceWorkerSource, /clients\.openWindow/);
});

test("service worker explicitly bypasses private and provider data", () => {
  for (const expected of [
    "/api/",
    "/auth/",
    "/api/explore/place-story/audio",
    "api.mapbox.com",
    "api.open-meteo.com",
    "nominatim.openstreetmap.org",
    "/locations/",
    "/image",
  ]) {
    assert.match(serviceWorkerSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(serviceWorkerSource, /cache\.put/);
  assert.doesNotMatch(serviceWorkerSource, /fetch\(request\)\.then/);
});

test("route notification registration uses the unified worker path", () => {
  assert.match(notificationSource, /navigator\.serviceWorker\.register\("\/wanderlog-sw\.js"\)/);
  assert.doesNotMatch(notificationSource, /route-generation-sw\.js/);
  assert.match(legacyWorkerSource, /importScripts\("\/wanderlog-sw\.js"\)/);
});

test("offline fallback is static and does not promise unsupported offline features", () => {
  assert.match(offlineSource, /WanderLog is offline/);
  assert.match(offlineSource, /routes, maps, diary changes, and AI features need a network connection/);
  assert.doesNotMatch(offlineSource, /sync later|edit offline|generate offline/i);
});
