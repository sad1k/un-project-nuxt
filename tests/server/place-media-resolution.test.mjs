/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const mediaSource = await readFile("lib/explore/place-media.ts", "utf8");
const providerSource = await readFile("lib/explore/place-intelligence-providers.ts", "utf8");
const locationImageQuerySource = await readFile("lib/db/queries/location-log-image.ts", "utf8");
const endpointSource = await readFile("server/api/explore/place-intelligence.get.ts", "utf8");
const photoEndpointSource = await readFile("server/api/explore/place-photo.get.ts", "utf8");

test("real place photo resolver checks public app photos before Google provider photos", () => {
  assert.match(mediaSource, /resolveRealPlacePhoto/);
  const appIndex = mediaSource.indexOf("deps.findAppPhoto ?? findAppPlacePhoto");
  const googleIndex = mediaSource.indexOf("deps.fetchGooglePhoto ?? fetchGooglePlaceMediaPhoto");
  const openIndex = mediaSource.indexOf("deps.fetchOpenProviderPhoto ?? fetchUnavailableOpenProviderPhoto");
  assert.ok(appIndex >= 0, "app photo resolver should be present");
  assert.ok(googleIndex > appIndex, "Google resolver should run after app photo resolver");
  assert.ok(openIndex > googleIndex, "open/provider fallback hook should run after Google");
  assert.match(mediaSource, /status:\s*"missing"/);
});

test("Wikimedia fallback runs after Google and before missing state", () => {
  assert.match(providerSource, /export async function fetchWikimediaPlacePhoto/);
  assert.match(providerSource, /https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(providerSource, /generator", "geosearch"/);
  assert.match(providerSource, /prop", "coordinates\|pageimages"/);
  assert.match(providerSource, /User-Agent": "WanderLog\/1\.0 real-place-photo-fallback"/);
  assert.match(mediaSource, /fetchWikimediaPlacePhoto/);
  assert.match(mediaSource, /source:\s*"wikimedia"/);
  assert.match(mediaSource, /licenseHint:\s*"wikimedia-page-image"/);
  assert.match(mediaSource, /verify source page license before durable reuse/);
});

test("public WanderLog photo matching is bounded and privacy filtered", () => {
  assert.match(locationImageQuerySource, /export async function findPublicPlacePhotoNear/);
  assert.match(locationImageQuerySource, /eq\(locationLogImage\.visibility,\s*"public"\)/);
  assert.match(locationImageQuerySource, /eq\(locationLogImage\.moderationStatus,\s*"visible"\)/);
  assert.match(locationImageQuerySource, /between\(locationLogImage\.publicLat/);
  assert.match(locationImageQuerySource, /between\(locationLogImage\.publicLong/);
  assert.match(locationImageQuerySource, /matchConfidence/);
  assert.doesNotMatch(locationImageQuerySource, /description:\s*locationLogImage\.description/);
});

test("Google photo media stays server-side and reference based", () => {
  assert.match(providerSource, /export async function fetchGooglePlacePhoto/);
  assert.match(providerSource, /providerPhotoReference/);
  assert.match(providerSource, /providerPlaceId/);
  assert.match(photoEndpointSource, /defineAuthenticatedHandler/);
  assert.match(photoEndpointSource, /places\.googleapis\.com\/v1/);
  assert.match(photoEndpointSource, /cache-control.*private, max-age=3600/s);
  assert.doesNotMatch(photoEndpointSource, /S3|PutObject|upload|writeFile/);
});

test("place intelligence endpoint consumes real photo resolver", () => {
  assert.match(endpointSource, /resolveRealPlacePhoto/);
  assert.match(endpointSource, /toPlacePhoto/);
  assert.match(endpointSource, /photo:\s*resolvedPhoto\.status === "photo"/);
  assert.doesNotMatch(endpointSource, /illustrative|AI-generated|stock/i);
});

test("real media source code does not expose provider secrets to clients", () => {
  for (const source of [mediaSource, endpointSource, photoEndpointSource]) {
    assert.doesNotMatch(source, /rawProvider|providerHeaders|payloadJson/);
  }
  assert.match(mediaSource, /logPlaceMediaDebug/);
  assert.match(mediaSource, /env\.NODE_ENV === "production"/);
  assert.match(mediaSource, /console\.warn\("\[place-media\]"/);
  assert.doesNotMatch(mediaSource, /GOOGLE_PLACES_API_KEY/);
  assert.doesNotMatch(providerSource, /WIKIMEDIA_API_KEY|WIKIDATA_API_KEY/);
});
