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
