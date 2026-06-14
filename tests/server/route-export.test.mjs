/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("route export builders target Google and Yandex with route params", async () => {
  const src = await readFile("lib/explore/route-export.ts", "utf8");
  assert.match(src, /export function buildGoogleMapsRouteUrl/);
  assert.match(src, /export function buildYandexMapsRouteUrl/);
  // Google: documented Directions URL with origin/destination/waypoints.
  assert.match(src, /www\.google\.com\/maps\/dir\/\?api=1/);
  assert.match(src, /origin=/);
  assert.match(src, /destination=/);
  assert.match(src, /waypoints=/);
  // Yandex: rtext route chain with an auto routing type.
  assert.match(src, /yandex\.ru\/maps\/\?rtext=/);
  assert.match(src, /rtt=auto/);
  // Yandex lat/lng-order gotcha: rtext is lat,lng but pt is lng,lat.
  assert.match(src, /\?pt=\$\{stops\[0\]\.lng/);
});

test("route export caps Google stops to stay within the consumer limit", async () => {
  const src = await readFile("lib/explore/route-export.ts", "utf8");
  assert.match(src, /GOOGLE_MAX_STOPS = 10/);
  assert.match(src, /droppedCount/);
});

test("explore mounts the route export control with the selected route", async () => {
  const src = await readFile("pages/explore.vue", "utf8");
  assert.match(src, /<ExploreRouteExportControl[\s\S]*?:route-points="selectedRoutePoints"/);
});

test("route export control offers both providers and opens a new tab", async () => {
  const src = await readFile("components/explore/route-export-control.vue", "utf8");
  assert.match(src, /buildRouteExportLink/);
  assert.ok(src.includes("Google Карты"), "Google provider label present");
  assert.ok(src.includes("Яндекс Карты"), "Yandex provider label present");
  assert.match(src, /window\.open\(/);
  // Only meaningful for a real route (>= 2 stops).
  assert.match(src, /routePoints\.length >= 2/);
});

test("offline region preview offers route export to Google/Yandex", async () => {
  const src = await readFile("components/offline/region-preview.vue", "utf8");
  assert.match(src, /buildRouteExportLink/);
  assert.match(src, /onOpenInMaps\(['"]google['"]\)/);
  assert.match(src, /onOpenInMaps\(['"]yandex['"]\)/);
  // Built from the saved region's points, opened in a new tab.
  assert.match(src, /props\.region\?\.routePoints/);
  assert.match(src, /window\.open\(/);
});

test("offline region preview shows the live GPS location", async () => {
  // GPS works offline on devices with a real receiver; the dot/accuracy ring
  // render client-side and need no glyphs.
  const src = await readFile("components/offline/region-preview.vue", "utf8");
  assert.match(src, /GeolocateControl/);
  assert.match(src, /enableHighAccuracy: true/);
  assert.match(src, /trackUserLocation: true/);
});
