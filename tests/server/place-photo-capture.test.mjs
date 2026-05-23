/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const nearbyEndpointSource = await readFile("server/api/place-photos/nearby-places.get.ts", "utf8");
const createPrivateEndpointSource = await readFile("server/api/place-photos/create-private.post.ts", "utf8");
const composableSource = await readFile("composables/use-place-photo-capture.ts", "utf8");
const quickCaptureSource = await readFile("components/place-photo/quick-capture.vue", "utf8");
const confirmationMapSource = await readFile("components/place-photo/location-confirmation-map.client.vue", "utf8");
const pageSource = await readFile("pages/dashboard/place-photo/new.vue", "utf8");

test("nearby place lookup is authenticated, coordinate based, and provider safe", () => {
  assert.match(nearbyEndpointSource, /defineAuthenticatedHandler/);
  assert.match(nearbyEndpointSource, /lat:\s*z\.coerce\.number\(\)\.min\(-90\)\.max\(90\)/);
  assert.match(nearbyEndpointSource, /long:\s*z\.coerce\.number\(\)\.min\(-180\)\.max\(180\)/);
  assert.match(nearbyEndpointSource, /https:\/\/nominatim\.openstreetmap\.org\/reverse/);
  assert.match(nearbyEndpointSource, /URLSearchParams/);
  assert.match(nearbyEndpointSource, /User-Agent/);
  assert.match(nearbyEndpointSource, /fallbackPlace/);
});

test("private quick capture creates diary place and log before image upload", () => {
  assert.match(createPrivateEndpointSource, /defineAuthenticatedHandler/);
  assert.match(createPrivateEndpointSource, /findOrCreateLocationForRoutePoint/);
  assert.match(createPrivateEndpointSource, /insertLocationLog/);
  assert.match(createPrivateEndpointSource, /locationSource:\s*z\.enum\(\["gps", "approximate", "manual"\]\)/);
  assert.match(createPrivateEndpointSource, /startedAt:\s*now/);
  assert.match(createPrivateEndpointSource, /endedAt:\s*now/);
  assert.match(createPrivateEndpointSource, /sign-images/);
  assert.match(createPrivateEndpointSource, /\/image/);
  assert.doesNotMatch(createPrivateEndpointSource, /visibility:\s*"public"|makeLocationLogImagePublic|createPost/);
});

test("capture composable handles camera file, GPS marker, provider suggestions, and upload chain", () => {
  assert.match(composableSource, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(composableSource, /accuracy <= 100 \? "gps" : "approximate"/);
  assert.match(composableSource, /\/api\/place-photos\/nearby-places/);
  assert.match(composableSource, /\/api\/place-photos\/create-private/);
  assert.match(composableSource, /signUrl/);
  assert.match(composableSource, /imageUrl/);
  assert.match(composableSource, /getChecksum/);
  assert.match(composableSource, /convertPhotoToUploadBlob/);
  assert.match(composableSource, /saved\.value = \{ \.\.\.created, image \}/);
  assert.doesNotMatch(composableSource, /visibility:\s*"public"|make public/i);
});

test("quick capture UI is camera first, requires explicit marker confirmation, and offers feed publish after upload", () => {
  assert.match(quickCaptureSource, /accept="image\/\*"/);
  assert.match(quickCaptureSource, /capture="environment"/);
  assert.match(quickCaptureSource, /requestCurrentPosition/);
  assert.match(quickCaptureSource, /PlacePhotoLocationConfirmationMap/);
  assert.match(quickCaptureSource, /confirmedPoint/);
  assert.match(quickCaptureSource, /nearbyPlaces/);
  assert.match(quickCaptureSource, /savePrivatePhoto/);
  assert.match(quickCaptureSource, /publishSavedPhotoToFeed/);
  assert.match(quickCaptureSource, /\/visibility/);
  assert.match(quickCaptureSource, /visibility:\s*"public"/);
  assert.match(quickCaptureSource, /\/api\/posts/);
  assert.match(quickCaptureSource, /locationLogImageId:\s*saved\.value\.image\.id/);
  assert.match(quickCaptureSource, /Опубликовать в ленту/);
  assert.match(quickCaptureSource, /to="\/feed\?tab=globe"/);
  assert.match(confirmationMapSource, /mapStore\.addedPoint/);
  assert.match(confirmationMapSource, /Перетащите|дважды нажмите/i);
});

test("quick capture page is reachable from dashboard routing", () => {
  assert.match(pageSource, /PlacePhotoQuickCapture/);
  assert.match(pageSource, /\/dashboard\/location\/\$\{saved\.location\.slug\}\/\$\{saved\.locationLog\.id\}/);
});
