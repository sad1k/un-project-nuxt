/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const nearbyLibSource = await readFile("lib/explore/nearby.ts", "utf8");
const endpointSource = await readFile("server/api/explore/nearby-places.get.ts", "utf8");
const composableSource = await readFile("composables/use-nearby-places.ts", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const markerSource = await readFile("components/explore/nearby-marker.ts", "utf8");
const controlSource = await readFile("components/explore/nearby-places-control.vue", "utf8");
const explorePageSource = await readFile("pages/explore.vue", "utf8");
const wizardSource = await readFile("components/explore/wizard.vue", "utf8");

test("nearby lib defines a coordinate-bearing place type and pure helpers", () => {
  assert.match(nearbyLibSource, /export type ExploreNearbyPlace/);
  assert.match(nearbyLibSource, /coordinates: ExploreCoordinates/);
  assert.match(nearbyLibSource, /export const NEARBY_INTEREST_QUERIES/);
  assert.match(nearbyLibSource, /export function normalizeMapboxNearbyFeature/);
  assert.match(nearbyLibSource, /export function dedupeNearbyPlaces/);
  assert.match(nearbyLibSource, /export function isExploreInterest/);
});

test("nearby lib stays detached from UI and side effects", () => {
  assert.doesNotMatch(nearbyLibSource, /\bref\(/);
  assert.doesNotMatch(nearbyLibSource, /\bfetch\(/);
  assert.doesNotMatch(nearbyLibSource, /console\./);
});

test("nearby endpoint does a proximity POI search returning coordinates", () => {
  assert.match(endpointSource, /lat: z\.coerce\.number\(\)\.min\(-90\)\.max\(90\)/);
  assert.match(endpointSource, /long: z\.coerce\.number\(\)\.min\(-180\)\.max\(180\)/);
  assert.match(endpointSource, /searchbox\/v1\/forward/);
  assert.match(endpointSource, /proximity:/);
  assert.match(endpointSource, /normalizeMapboxNearbyFeature/);
  assert.match(endpointSource, /dedupeNearbyPlaces/);
  // Distance-sorted so the closest suggestions surface first.
  assert.match(endpointSource, /distanceMeters/);
  assert.match(endpointSource, /\.sort\(/);
});

test("nearby composable manages a draggable marker and place selection", () => {
  assert.match(composableSource, /export function useNearbyPlaces/);
  for (const member of [
    "activate",
    "deactivate",
    "locate",
    "setMarker",
    "fetchNearby",
    "addPlace",
    "isAdded",
    "recenterRequest",
  ]) {
    assert.match(composableSource, new RegExp(member));
  }
  assert.match(composableSource, /useCurrentLocation/);
  assert.match(composableSource, /useExploreContext/);
  assert.match(composableSource, /useUserRoutePoints/);
  // Adopting a nearby place reuses the manual anchor-point flow.
  assert.match(composableSource, /addUserPoint/);
  assert.match(composableSource, /\/api\/explore\/nearby-places/);
});

test("mapbox composable can render a location marker and nearby markers", () => {
  assert.match(mapboxSource, /function setLocationMarker/);
  assert.match(mapboxSource, /function removeLocationMarker/);
  assert.match(mapboxSource, /function setNearbyMarkers/);
  assert.match(mapboxSource, /function clearNearbyMarkers/);
  // The location marker is draggable so the user can search around another spot.
  assert.match(mapboxSource, /new mb\.Marker\(\{ element, draggable: true \}\)/);
  assert.match(mapboxSource, /locationMarkerDragHandler/);
});

test("nearby marker module builds a distinct marker and popup", () => {
  assert.match(markerSource, /export function createNearbyMarkerElement/);
  assert.match(markerSource, /export function createNearbyPopupHTML/);
});

test("nearby control renders a panel driven by isActive (no toggle)", () => {
  assert.match(controlSource, /useNearbyPlaces/);
  assert.match(controlSource, /data-testid="explore-nearby-panel"/);
  assert.match(controlSource, /v-if="isActive"/);
  assert.match(controlSource, /Места рядом/);
  assert.match(controlSource, /addPlace|onAdd/);
  assert.match(controlSource, /isAdded/);
  // Entry moved into the wizard — the old in-corner toggle is gone.
  assert.doesNotMatch(controlSource, /explore-nearby-toggle/);
});

test("explore page wires the nearby feature into the map", () => {
  assert.match(explorePageSource, /useNearbyPlaces/);
  assert.match(explorePageSource, /ExploreNearbyPlacesControl/);
  assert.match(explorePageSource, /setLocationMarker/);
  assert.match(explorePageSource, /setNearbyMarkers/);
  // Mutually exclusive with the other map interaction modes.
  assert.match(explorePageSource, /nearby\.deactivate\(\)/);
  // Panel is mounted as a standalone overlay, not stacked next to the manual
  // points control in the bottom-left group.
  assert.doesNotMatch(
    explorePageSource,
    /<ExploreManualPointsControl \/>\s*<ExploreNearbyPlacesControl \/>/,
  );
});

test("wizard surfaces the nearby entry on the city step", () => {
  assert.match(wizardSource, /useNearbyPlaces/);
  assert.match(wizardSource, /data-testid="explore-nearby-entry"/);
  assert.match(wizardSource, /Рядом со мной/);
  // Tap activates the existing nearby flow.
  assert.match(wizardSource, /nearby\.activate\(\)/);
  // Only on the city step, hidden while the city dropdown is open.
  assert.match(wizardSource, /currentStep === 'city'/);
  assert.match(wizardSource, /!dropdownOpen/);
  // Wizard collapses out of the way on mobile while nearby is active.
  assert.match(wizardSource, /nearby\.isActive\.value/);
});
