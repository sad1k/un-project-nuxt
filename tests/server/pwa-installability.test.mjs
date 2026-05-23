/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const appSource = await readFile("app.vue", "utf8");
const manifestSource = await readFile("public/manifest.webmanifest", "utf8");
const iconSource = await readFile("public/icons/wanderlog-icon.svg", "utf8");
const maskableIconSource = await readFile("public/icons/wanderlog-maskable.svg", "utf8");
const manifest = JSON.parse(manifestSource);

const secretPatterns = [
  /OPENAI_API_KEY/,
  /TURSO_AUTH_TOKEN/,
  /S3_SECRET_KEY/,
  /S3_ACCESS_KEY/,
  /GOOGLE_CLIENT_SECRET/,
  /sessionId/,
  /userId/,
  /routePointId/,
];

test("app shell exposes web app manifest and mobile metadata", () => {
  assert.match(appSource, /useHead/);
  assert.match(appSource, /rel:\s*"manifest"/);
  assert.match(appSource, /href:\s*"\/manifest\.webmanifest"/);
  assert.match(appSource, /wanderlog-icon-192\.png/);
  assert.match(appSource, /wanderlog-apple-touch\.png/);
  assert.match(appSource, /theme-color/);
  assert.match(appSource, /apple-mobile-web-app-capable/);
});

test("manifest contains installability metadata and local icons", () => {
  assert.equal(manifest.name, "WanderLog");
  assert.equal(manifest.short_name, "WanderLog");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.theme_color, /^#[0-9A-F]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9A-F]{6}$/i);
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.length >= 3);
  assert.ok(manifest.icons.some(icon => icon.src === "/icons/wanderlog-icon-192.png" && icon.sizes === "192x192" && icon.type === "image/png" && icon.purpose === "any"));
  assert.ok(manifest.icons.some(icon => icon.src === "/icons/wanderlog-icon-512.png" && icon.sizes === "512x512" && icon.type === "image/png" && icon.purpose === "any"));
  assert.ok(manifest.icons.some(icon => icon.src === "/icons/wanderlog-maskable-512.png" && icon.sizes === "512x512" && icon.type === "image/png" && icon.purpose === "maskable"));
});

test("manifest exposes rich install screenshots for desktop and mobile", () => {
  assert.ok(Array.isArray(manifest.screenshots));
  assert.ok(manifest.screenshots.some(screenshot =>
    screenshot.src === "/screenshots/wanderlog-wide.png"
    && screenshot.sizes === "1280x720"
    && screenshot.type === "image/png"
    && screenshot.form_factor === "wide",
  ));
  assert.ok(manifest.screenshots.some(screenshot =>
    screenshot.src === "/screenshots/wanderlog-mobile.png"
    && screenshot.sizes === "390x844"
    && screenshot.type === "image/png"
    && !("form_factor" in screenshot),
  ));
});

test("manifest and icons do not expose secrets or private route context", () => {
  for (const source of [appSource, manifestSource, iconSource, maskableIconSource]) {
    for (const pattern of secretPatterns)
      assert.doesNotMatch(source, pattern);
  }
});

test("manifest image assets exist as non-empty PNG files", async () => {
  const pngAssets = [
    "public/icons/wanderlog-icon-192.png",
    "public/icons/wanderlog-icon-512.png",
    "public/icons/wanderlog-maskable-512.png",
    "public/icons/wanderlog-apple-touch.png",
    "public/screenshots/wanderlog-mobile.png",
    "public/screenshots/wanderlog-wide.png",
  ];

  for (const asset of pngAssets) {
    const [metadata, bytes] = await Promise.all([
      stat(asset),
      readFile(asset),
    ]);

    assert.ok(metadata.size > 0);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
