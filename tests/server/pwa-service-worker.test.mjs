/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const swPath = "public/wanderlog-sw.js";
const serviceWorkerSource = await readFile(swPath, "utf8");
const notificationSource = await readFile("composables/use-route-generation-notifications.ts", "utf8");
const offlineSource = await readFile("public/offline.html", "utf8");

test("unified app service worker owns push notifications and navigation fallback", () => {
  for (const eventName of ["activate", "push", "notificationclick", "message"])
    assert.match(serviceWorkerSource, new RegExp(`addEventListener\\(["']${eventName}["']`));

  assert.match(serviceWorkerSource, /wl-static-v1/);
  assert.match(serviceWorkerSource, /\/offline\.html/);
  assert.match(serviceWorkerSource, /showNotification/);
  assert.match(serviceWorkerSource, /clients\.openWindow/);
});

test("service worker scoping does not match private or provider data via registered routes", () => {
  // Routes must filter out auth, audio (large), and health from runtime caching.
  assert.match(serviceWorkerSource, /\/api\/auth/);
  assert.match(serviceWorkerSource, /\/api\/explore\/place-story\/audio/);
  // No hand-rolled cache.put outside Workbox primitives.
  assert.doesNotMatch(serviceWorkerSource, /cache\.put\(/);
});

test("route notification registration uses the unified worker path", () => {
  assert.match(notificationSource, /navigator\.serviceWorker\.register\("\/wanderlog-sw\.js"\)/);
  assert.doesNotMatch(notificationSource, /route-generation-sw\.js/);
});

test("offline fallback is static and does not promise unsupported offline features", () => {
  assert.match(offlineSource, /WanderLog is offline/);
  assert.match(offlineSource, /routes, maps, diary changes, and AI features need a network connection/);
  assert.doesNotMatch(offlineSource, /sync later|edit offline|generate offline/i);
});

test("imports workbox primitives", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("workbox-precaching"));
  assert.ok(sw.includes("workbox-routing"));
  assert.ok(sw.includes("workbox-strategies"));
  assert.ok(sw.includes("workbox-background-sync"));
  assert.ok(sw.includes("workbox-expiration"));
});

test("precaches __WB_MANIFEST", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("self.__WB_MANIFEST"));
  assert.ok(sw.includes("precacheAndRoute"));
});

test("registers NetworkFirst route for /api/ GET", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("NetworkFirst"));
  assert.match(sw, /registerRoute[\s\S]*\/api\//);
});

test("registers CacheFirst route for images", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("CacheFirst"));
  assert.ok(sw.includes("wl-images-v1"));
});

test("registers StaleWhileRevalidate for nuxt assets", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("StaleWhileRevalidate"));
  assert.ok(sw.includes("/_nuxt/"));
});

test("uses workbox Queue with queue name wl-writes", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("workbox-background-sync"));
  assert.ok(sw.includes("Queue"));
  assert.ok(sw.includes("wl-writes"));
});

test("preserves existing push handler", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.match(/addEventListener\(["']push["']/));
  assert.ok(sw.match(/addEventListener\(["']notificationclick["']/));
});

test("uses ExpirationPlugin for runtime caches", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("ExpirationPlugin"));
  assert.ok(sw.includes("purgeOnQuotaError"));
});

test("declares wl-api-v1 cache name", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("wl-api-v1"));
});
