/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile("lib/explore/route-map.ts", "utf8");
const explorePageSource = await readFile("pages/explore.vue", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const routePanelSource = await readFile("components/explore/route-panel.vue", "utf8");
const routeDaySelectorSource = await readFile("components/explore/route-day-selector.vue", "utf8");
const routeDistanceSummarySource = await readFile("components/explore/route-distance-summary.vue", "utf8");

test("route map helper exports the shared display model API", () => {
  for (const exportName of [
    "RouteMarkerKind",
    "RouteMapPoint",
    "RouteLeg",
    "RouteDayGroup",
    "RouteDistanceSummary",
    "toRouteMapPoints",
    "getRouteDayGroups",
    "filterRoutePointsByDay",
    "buildRouteLegs",
    "summarizeRouteDistance",
    "formatRouteDistance",
  ]) {
    assert.match(source, new RegExp(`export (type |function )${exportName}`));
  }
});

test("route map helper consumes the Phase 3 route point contract", () => {
  assert.match(source, /import type \{ RoutePoint \} from "~\/lib\/ai\/route-contract"/);
  assert.match(source, /lng: point\.coordinates\.long/);
  assert.match(source, /lat: point\.coordinates\.lat/);
  assert.match(source, /day: point\.day/);
});

test("route map helper supports selected-day filtering and day groups", () => {
  assert.match(source, /selectedDay: number \| null \| undefined/);
  assert.match(source, /return points\.filter\(point => point\.day === selectedDay\)/);
  assert.match(source, /new Map<number, RouteMapPoint\[\]>/);
  assert.match(source, /\.sort\(\(\[firstDay\], \[secondDay\]\) => firstDay - secondDay\)/);
});

test("route map helper builds route legs, labels, and distance summary", () => {
  assert.match(source, /approximateDistanceMeters/);
  assert.match(source, /distanceMeters: number \| null/);
  assert.match(source, /distanceLabel: string \| null/);
  assert.match(source, /formatRouteDistance\(distanceMeters\)/);
  assert.match(source, /knownDistanceMeters/);
  assert.match(source, /missingLegCount/);
  assert.match(source, /complete: legs\.length > 0 && missingLegCount === 0/);
});

test("route map helper distinguishes generated and user-owned marker kinds", () => {
  assert.match(source, /"generated" \| "current-location" \| "user-place"/);
  assert.match(source, /markerKind: RouteMarkerKind = "generated"/);
  assert.match(source, /id: `\$\{markerKind\}-\$\{point\.id\}`/);
});

test("route map helper stays detached from UI, Mapbox, provider calls, and env", () => {
  assert.doesNotMatch(source, /\bref\(/);
  assert.doesNotMatch(source, /\bcomputed\(/);
  assert.doesNotMatch(source, /mapbox/i);
  assert.doesNotMatch(source, /\bfetch\(/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /console\./);
});

test("Explore page renders selected route sections through the route-map model", () => {
  assert.match(explorePageSource, /toRouteMapPoints/);
  assert.match(explorePageSource, /filterRoutePointsByDay/);
  assert.match(explorePageSource, /buildRouteLegs/);
  assert.match(explorePageSource, /useState<number \| null>\("explore-selected-route-day"/);
  assert.match(explorePageSource, /mapbox\.renderRoute\(pts, legs\)/);
  assert.match(explorePageSource, /mapbox\.fitToRoute\(pts\)/);
});

test("Mapbox route rendering uses road geometry with a safe direct-line fallback", () => {
  assert.match(mapboxSource, /directions\/v5\/mapbox/);
  assert.match(mapboxSource, /MAPBOX_DIRECTIONS_PROFILE = "walking"/);
  assert.match(mapboxSource, /geometries: "geojson"/);
  assert.match(mapboxSource, /overview: "full"/);
  assert.match(mapboxSource, /drawRouteLine\(points\)/);
  assert.match(mapboxSource, /drawRoadRouteLine\(points, requestId\)/);
  assert.match(mapboxSource, /routeCoordinates\.length < 2/);
  assert.match(mapboxSource, /removeLayerAndSource\(ROUTE_LINE_LAYER_ID, ROUTE_LINE_SOURCE_ID\)/);
});

test("Explore route panel exposes day selection and distance summary UI", () => {
  assert.match(routePanelSource, /ExploreRouteDaySelector/);
  assert.match(routePanelSource, /v-model="selectedDay"/);
  assert.match(routePanelSource, /ExploreRouteDistanceSummary/);
  assert.match(routePanelSource, /selectedRoutePoints/);
  assert.match(routePanelSource, /selectedRouteLegs/);
  assert.match(routeDaySelectorSource, /Все/);
  assert.match(routeDaySelectorSource, /День \{\{ group\.day \}\}/);
  assert.match(routeDistanceSummarySource, /summarizeRouteDistance/);
  assert.match(routeDistanceSummarySource, /Нет оценки расстояния/);
});
