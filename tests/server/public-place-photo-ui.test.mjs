/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const publicLayerSource = await readFile("components/place-photo/public-photo-layer.client.vue", "utf8");
const publicPopupSource = await readFile("components/place-photo/public-photo-popup.vue", "utf8");
const controlsSource = await readFile("components/place-photo/photo-visibility-controls.vue", "utf8");
const logPageSource = await readFile("pages/dashboard/location/[slug]/[id].vue", "utf8");

test("public photo layer fetches public photos and renders mapbox markers", () => {
  assert.match(publicLayerSource, /\/api\/public\/place-photos/);
  assert.match(publicLayerSource, /mapbox-gl/);
  assert.match(publicLayerSource, /new mb\.Marker/);
  assert.match(publicLayerSource, /new mb\.Popup/);
  assert.match(publicLayerSource, /s3BucketUrl/);
  assert.match(publicLayerSource, /tabler-photo-scan/);
});

test("public photo popup exposes only public card fields", () => {
  assert.match(publicPopupSource, /photo\.publicPlaceName/);
  assert.match(publicPopupSource, /photo\.authorName/);
  assert.match(publicPopupSource, /publishedAt/);
  assert.doesNotMatch(publicPopupSource, /description|locationLog|userId|caption/i);
  assert.doesNotMatch(publicLayerSource, /description|locationLogId|userId|caption/i);
});

test("owner controls patch image visibility without feed posts", () => {
  assert.match(controlsSource, /\/visibility/);
  assert.match(controlsSource, /visibility:\s*"public"/);
  assert.match(controlsSource, /visibility:\s*"private"/);
  assert.match(controlsSource, /publicPlaceName/);
  assert.match(controlsSource, /publicLat/);
  assert.match(controlsSource, /publicLong/);
  assert.match(controlsSource, /@click="makePublic"/);
  assert.match(controlsSource, /@click="makePrivate"/);
  assert.doesNotMatch(controlsSource, /\/api\/posts|createPost|caption/i);
});

test("diary log page renders visibility controls for each image", () => {
  assert.match(logPageSource, /PlacePhotoPhotoVisibilityControls/);
  assert.match(logPageSource, /@updated="locationStore\.currentLocationLogRefresh"/);
});
