/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("road route fetcher is shared, not private to use-mapbox", async () => {
  // The offline download flow must capture the road-following line while
  // online. The fetcher lives in use-mapbox as a module-private function
  // bound to module state (mapboxAccessToken) — extract it to a lib module
  // that takes the token as a parameter.
  const roadRouteSource = await readFile("lib/explore/road-route.ts", "utf8");
  assert.match(roadRouteSource, /export async function fetchMapboxRoadRouteCoordinates/);
  assert.match(roadRouteSource, /export const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25/);
  assert.match(roadRouteSource, /accessToken: string/);

  const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
  assert.match(
    mapboxSource,
    /import \{ fetchMapboxRoadRouteCoordinates \} from "~\/lib\/explore\/road-route"/,
  );
  assert.ok(
    !mapboxSource.includes("async function fetchMapboxRoadRouteCoordinates"),
    "use-mapbox must not keep a local copy of the directions fetcher",
  );
});

test("offline region record persists route points and geometry", async () => {
  const storeSource = await readFile("lib/offline/region-store.ts", "utf8");
  // New fields on the record + input.
  assert.match(storeSource, /routePoints\?: RouteMapPoint\[\];/);
  assert.match(storeSource, /routeGeometry\?: \[number, number\]\[\] \| null;/);
  // Vue reactive proxies throw DataCloneError in IndexedDB (same hazard
  // toPlainBbox already guards) — points must be cloned to plain objects.
  assert.match(storeSource, /function toPlainRoutePoints/);
  assert.match(storeSource, /toPlainRoutePoints\(input\.routePoints\)/);
  // routeGeometry must be patchable after the fact (it arrives async,
  // in parallel with the tile download).
  assert.match(storeSource, /"routeGeometry"/);
});

test("download flow forwards the actual route points into the region record", async () => {
  const triggerSource = await readFile("components/offline/download-trigger.vue", "utf8");
  assert.match(triggerSource, /routePoints: \[\.\.\.props\.routePoints\]/);

  const exploreSource = await readFile("pages/explore.vue", "utf8");
  assert.match(exploreSource, /routePoints: RouteMapPoint\[\];/);

  const sheetSource = await readFile("components/offline/download-sheet.vue", "utf8");
  assert.match(sheetSource, /routePoints: payload\.routePoints/);
});
