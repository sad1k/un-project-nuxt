/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const routeMapSource = await readFile("lib/explore/route-map.ts", "utf8");
const userPointsSource = await readFile("composables/use-user-route-points.ts", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const explorePageSource = await readFile("pages/explore.vue", "utf8");
const markerSource = await readFile("components/explore/route-marker.ts", "utf8");
const controlSource = await readFile("components/explore/manual-points-control.vue", "utf8");

test("route map helper exposes proximity insertion utilities", () => {
  for (const exportName of [
    "haversineDistanceMeters",
    "findCheapestInsertionIndex",
    "foldUserPointsIntoRoute",
  ]) {
    assert.match(routeMapSource, new RegExp(`export function ${exportName}`));
  }
  assert.match(routeMapSource, /findCheapestInsertionIndex\(combined, userPoint\)/);
});

test("proximity helpers stay detached from UI and side effects", () => {
  assert.doesNotMatch(routeMapSource, /\bref\(/);
  assert.doesNotMatch(routeMapSource, /\bfetch\(/);
  assert.doesNotMatch(routeMapSource, /console\./);
});

test("user route points composable manages manual placement state", () => {
  assert.match(userPointsSource, /export function useUserRoutePoints/);
  for (const member of [
    "isAddMode",
    "addUserPoint",
    "removeUserPoint",
    "clearUserPoints",
    "toggleAddMode",
    "toUserRouteMapPoint",
  ]) {
    assert.match(userPointsSource, new RegExp(member));
  }
  assert.match(userPointsSource, /markerKind: "user-place"/);
});

test("mapbox composable supports click-to-place point mode", () => {
  assert.match(mapboxSource, /function enablePointPlacement/);
  assert.match(mapboxSource, /function disablePointPlacement/);
  assert.match(mapboxSource, /map\.on\("click", pointPlacementHandler\)/);
  assert.match(mapboxSource, /cursor = "crosshair"/);
  assert.match(mapboxSource, /onRemoveRequest/);
});

test("explore page folds manual points into the active route", () => {
  assert.match(explorePageSource, /useUserRoutePoints/);
  assert.match(explorePageSource, /foldUserPointsIntoRoute/);
  assert.match(explorePageSource, /findCheapestInsertionIndex/);
  assert.match(explorePageSource, /enablePointPlacement/);
  assert.match(explorePageSource, /ExploreManualPointsControl/);
});

test("manual point markers can be removed from the map", () => {
  assert.match(markerSource, /data-place-remove-cta/);
  assert.match(controlSource, /useUserRoutePoints/);
  assert.match(controlSource, /toggleAddMode/);
});

test("manual points can be handed to the AI assistant to complete the route", () => {
  assert.match(userPointsSource, /export function useUserRoutePoints/);
  assert.match(userPointsSource, /function toAnchorPoint/);
  assert.match(controlSource, /useAiRouteSession/);
  assert.match(controlSource, /useExploreContext/);
  assert.match(controlSource, /completeWithAssistant/);
  assert.match(controlSource, /submitFollowUp/);
  assert.match(controlSource, /generateRoute/);
  // Points are handed over as anchors, not as ordinary candidate places.
  assert.match(controlSource, /toAnchorPoint/);
  assert.match(controlSource, /anchorPoints/);
});

test("assistant button stays usable from points alone via a derived region anchor", () => {
  assert.match(userPointsSource, /function buildAnchorCity/);
  // Enabled by the presence of points, not gated on a pre-selected city/route.
  assert.match(controlSource, /Boolean\(count\.value && !isGenerating\.value\)/);
  assert.match(controlSource, /city: base\.city \?\? buildAnchorCity\(\)/);
});
