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

  assert.match(serviceWorkerSource, /wanderlog-app-shell-v\d+/);
  assert.match(serviceWorkerSource, /\/offline\.html/);
  assert.match(serviceWorkerSource, /request\.mode === "navigate"/);
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
});

test("service worker caches the static app shell for offline boot", () => {
  // App shell precache covers the bare HTML fallback plus icons.
  assert.match(serviceWorkerSource, /wanderlog-app-shell-v2/);
  assert.match(serviceWorkerSource, /PRECACHE_ASSETS/);
  assert.match(serviceWorkerSource, /cache\.addAll\(PRECACHE_ASSETS\)/);

  // Runtime cache covers the hashed Nuxt bundle and static assets so
  // the SPA can boot on a cold offline visit.
  assert.match(serviceWorkerSource, /\/_nuxt\//);
  assert.match(serviceWorkerSource, /RUNTIME_CACHE/);
  assert.match(serviceWorkerSource, /cacheFirst/);

  // Cross-origin font hosts are explicitly allow-listed for runtime
  // caching — Google Fonts is the only third-party allowed in.
  assert.match(serviceWorkerSource, /fonts\.googleapis\.com/);
  assert.match(serviceWorkerSource, /fonts\.gstatic\.com/);

  // Navigations get cached so the same URL works on the next offline
  // visit; the catch path falls back to the cached HTML, then offline.
  assert.match(serviceWorkerSource, /handleNavigate/);
  assert.match(serviceWorkerSource, /NAV_CACHE/);
});

test("route notification registration uses the unified worker path", () => {
  assert.match(notificationSource, /navigator\.serviceWorker\.register\("\/wanderlog-sw\.js"\)/);
  assert.doesNotMatch(notificationSource, /route-generation-sw\.js/);
  assert.match(legacyWorkerSource, /importScripts\("\/wanderlog-sw\.js"\)/);
});

test("offline fallback is honest about what works and what does not", () => {
  assert.match(offlineSource, /WanderLog is offline/);
  // Routes/diary/AI still need network — we never promise they sync later.
  assert.match(offlineSource, /Routes, diary changes, and AI features need a network connection/);
  // Saved offline regions DO work (the only honest claim we add now).
  assert.match(offlineSource, /Saved offline regions remain available/);
  assert.doesNotMatch(offlineSource, /sync later|edit offline|generate offline/i);
});
