/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const mediaSource = await readFile("lib/explore/place-media.ts", "utf8");
const providerSource = await readFile("lib/explore/place-intelligence-providers.ts", "utf8");
const locationImageQuerySource = await readFile("lib/db/queries/location-log-image.ts", "utf8");
const endpointSource = await readFile("server/api/explore/place-intelligence.get.ts", "utf8");
const photoEndpointSource = await readFile("server/api/explore/place-photo.get.ts", "utf8");
const quotaSource = await readFile("lib/explore/provider-quota.ts", "utf8").catch(() => "");
const usageQuerySource = await readFile("lib/db/queries/provider-usage.ts", "utf8").catch(() => "");
const envSource = await readFile("lib/env.ts", "utf8").catch(() => "");

test("real place photo resolver prefers app, then TripAdvisor, then Wikidata, then Wikimedia, then Wikimapia, then Flickr, then Mapillary, then Google", () => {
  assert.match(mediaSource, /resolveRealPlacePhoto/);
  const appIndex = mediaSource.indexOf("deps.findAppPhoto ?? findAppPlacePhoto");
  const googleIndex = mediaSource.indexOf("deps.fetchGooglePhoto ?? fetchGooglePlaceMediaPhoto");
  const wikidataIndex = mediaSource.indexOf("deps.fetchWikidataPhoto ?? fetchWikidataPlaceMediaPhoto");
  const openIndex = mediaSource.indexOf("deps.fetchOpenProviderPhoto ?? fetchUnavailableOpenProviderPhoto");
  const wikimapiaIndex = mediaSource.indexOf("deps.fetchWikimapiaPhoto ?? fetchWikimapiaPlaceMediaPhoto");
  const flickrIndex = mediaSource.indexOf("deps.fetchFlickrPhoto ?? fetchFlickrPlaceMediaPhoto");
  const tripAdvisorIndex = mediaSource.indexOf("deps.fetchTripAdvisorPhoto ?? fetchTripAdvisorPlaceMediaPhoto");
  const mapillaryIndex = mediaSource.indexOf("deps.fetchMapillaryPhoto ?? fetchMapillaryPlaceMediaPhoto");
  assert.ok(appIndex >= 0, "app photo resolver should be present");
  assert.ok(tripAdvisorIndex > appIndex, "TripAdvisor runs first among providers, right after the app's own photos");
  assert.ok(wikidataIndex > tripAdvisorIndex, "curated Wikidata P18 runs after TripAdvisor");
  assert.ok(openIndex > wikidataIndex, "Wikimedia Commons should run after curated Wikidata P18");
  assert.ok(wikimapiaIndex > openIndex, "Wikimapia resolver should run after the free Wikimedia fallback");
  assert.ok(flickrIndex > wikimapiaIndex, "Flickr should run after Wikimapia");
  assert.ok(mapillaryIndex > flickrIndex, "street-level Mapillary should run after Flickr");
  assert.ok(googleIndex > mapillaryIndex, "paid Google resolver should run after the free street-level fallback");
  assert.match(mediaSource, /status:\s*"missing"/);
});

test("Wikimedia is a free fallback that runs before Google and ahead of missing state", () => {
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

test("Mapillary is a free street-level fallback that runs before paid Google", () => {
  assert.match(providerSource, /export async function fetchMapillaryPlacePhoto/);
  assert.match(providerSource, /https:\/\/graph\.mapillary\.com\/images/);
  // Token must travel in the OAuth header, never as a query param that could leak into logs.
  assert.match(providerSource, /Authorization:\s*`OAuth \$\{env\.MAPILLARY_ACCESS_TOKEN\}`/);
  assert.match(providerSource, /searchParams\.set\("bbox"/);
  assert.doesNotMatch(providerSource, /searchParams\.set\("access_token"/);
  // A 250m bbox over central Moscow makes Mapillary 500 ("reduce the amount of data"); the
  // resolver must search a tight, escalating radius instead of one oversized box.
  assert.match(providerSource, /for \(const radiusMeters of MAPILLARY_SEARCH_RADII_METERS\)/);
  assert.match(providerSource, /MAPILLARY_SEARCH_RADII_METERS\s*=\s*\[30, 60\]/);
  // Street-level frames are matched purely by proximity, so they must never claim "high".
  assert.match(providerSource, /MAPILLARY_MEDIUM_CONFIDENCE_METERS/);
  assert.doesNotMatch(providerSource, /matchConfidence:\s*"high"/);
  assert.match(mediaSource, /fetchMapillaryPlacePhoto/);
  assert.match(mediaSource, /source:\s*"mapillary"/);
  assert.match(mediaSource, /licenseHint:\s*"mapillary-street-level-cc-by-sa"/);
});

test("Wikidata P18 is a keyless curated-photo provider that depicts the entity itself", () => {
  assert.match(providerSource, /export async function fetchWikidataPlacePhoto/);
  // Geospatial SPARQL: nearby entities (P625) that carry a curated image (P18).
  assert.match(providerSource, /query\.wikidata\.org\/sparql/);
  assert.match(providerSource, /wikibase:around/);
  assert.match(providerSource, /wdt:P18/);
  // No API key — Wikidata is open; WDQS just needs a descriptive User-Agent and a timeout guard.
  assert.doesNotMatch(providerSource, /WIKIDATA_API_KEY/);
  assert.match(providerSource, /WIKIDATA_QUERY_TIMEOUT_MS/);
  // Precision guard: only a real name match, never a neighbouring monument's photo.
  assert.match(providerSource, /candidate\.nameScore !== "low"/);
  assert.match(mediaSource, /fetchWikidataPlacePhoto/);
  assert.match(mediaSource, /source:\s*"wikidata"/);
  assert.match(mediaSource, /licenseHint:\s*"wikidata-p18-commons-image"/);
});

test("Wikimapia is a free place-depicting fallback (two-step getnearest → getbyid) ahead of street-level Mapillary", () => {
  assert.match(providerSource, /export async function fetchWikimapiaPlacePhoto/);
  // Two-step: getnearest returns no photos, so a getbyid follow-up fetches the photo block.
  assert.match(providerSource, /"place\.getnearest"/);
  assert.match(providerSource, /"place\.getbyid"/);
  assert.match(providerSource, /data_blocks/);
  // Photo URLs are served over http; they must be upgraded to https to avoid mixed-content.
  assert.match(providerSource, /upgrade to https to avoid mixed-content/);
  // Precision guard: only return a photo on a real name match, never the nearest stray object
  // (getnearest otherwise yields a "vase"/"cannon" inside a large landmark).
  assert.match(providerSource, /candidate\.nameScore !== "low"/);
  assert.match(mediaSource, /fetchWikimapiaPlacePhoto/);
  assert.match(mediaSource, /source:\s*"wikimapia"/);
  assert.match(mediaSource, /licenseHint:\s*"wikimapia-user-photo-cc-by-sa"/);
  // CC BY-SA requires crediting Wikimapia with a link back.
  assert.match(mediaSource, /wikimapia\.org/);
});

test("Flickr is a free name+geo photo fallback restricted to openly-licensed media", () => {
  assert.match(providerSource, /export async function fetchFlickrPlacePhoto/);
  assert.match(providerSource, /api\.flickr\.com\/services\/rest/);
  assert.match(providerSource, /flickr\.photos\.search/);
  // Place name as `text` is both the relevance signal and the geo "limiting agent".
  assert.match(providerSource, /searchParams\.set\("text", input\.name\)/);
  assert.match(providerSource, /searchParams\.set\("radius"/);
  // Only openly-licensed media (every licence except 0 = All Rights Reserved).
  assert.match(providerSource, /FLICKR_REUSABLE_LICENSES/);
  assert.doesNotMatch(providerSource, /FLICKR_API_KEY"/);
  assert.match(mediaSource, /fetchFlickrPlacePhoto/);
  assert.match(mediaSource, /source:\s*"flickr"/);
  assert.match(mediaSource, /licenseHint:\s*"flickr-cc-licensed-photo"/);
});

test("TripAdvisor is a two-step venue-photo fallback (location search → photos) with display terms", () => {
  assert.match(providerSource, /export async function fetchTripAdvisorPlacePhoto/);
  assert.match(providerSource, /api\.content\.tripadvisor\.com/);
  // Two-step: location/search by name+latLong → location/{id}/photos.
  assert.match(providerSource, /location\/search/);
  assert.match(providerSource, /\/photos/);
  assert.match(providerSource, /searchParams\.set\("latLong"/);
  // Precision guard: only a real name match, never a neighbouring venue.
  assert.match(providerSource, /candidate\.nameScore !== "low"/);
  assert.match(mediaSource, /fetchTripAdvisorPlacePhoto/);
  assert.match(mediaSource, /source:\s*"tripadvisor"/);
  assert.match(mediaSource, /licenseHint:\s*"tripadvisor-content-api-photo"/);
  // TripAdvisor requires showing attribution and linking back.
  assert.match(mediaSource, /display requirements/);
});

test("TripAdvisor (paid) photo calls are capped by a persistent billing quota, gated before the paid call", () => {
  // Provider checks the quota and reserves a billable slot before the paid photos request.
  assert.match(providerSource, /isTripAdvisorQuotaExceeded/);
  assert.match(providerSource, /recordTripAdvisorCall/);
  const gateIdx = providerSource.indexOf("isTripAdvisorQuotaExceeded()");
  const recordIdx = providerSource.indexOf("recordTripAdvisorCall()");
  const photosIdx = providerSource.indexOf("fetchTripAdvisorLocationPhoto(location.id)");
  assert.ok(gateIdx >= 0 && photosIdx > gateIdx, "quota gate must run before the paid photos call");
  assert.ok(recordIdx >= 0 && photosIdx > recordIdx, "a billable slot must be reserved before the paid photos call");
  // Quota module: day + month caps from env; fails CLOSED on error (no uncapped spend).
  assert.match(quotaSource, /TRIPADVISOR_DAILY_LIMIT/);
  assert.match(quotaSource, /TRIPADVISOR_MONTHLY_LIMIT/);
  assert.match(quotaSource, /catch\s*\{\s*return true/);
  // Counter persists across restarts via an atomic SQL increment (DB-backed, not in-memory).
  assert.match(usageQuerySource, /onConflictDoUpdate/);
  assert.match(usageQuerySource, /\+ 1/);
  // Env exposes the caps with safe in-free-tier defaults.
  assert.match(envSource, /TRIPADVISOR_DAILY_LIMIT/);
  assert.match(envSource, /TRIPADVISOR_MONTHLY_LIMIT/);
});

test("Provider-native reviews come first; TripAdvisor is the quota-gated fallback (full call only)", () => {
  assert.match(providerSource, /export async function fetchTripAdvisorPlaceReviews/);
  assert.match(providerSource, /\/reviews/);
  // Reviews hit a billable TripAdvisor endpoint → same quota gate + record as photos.
  const start = providerSource.indexOf("export async function fetchTripAdvisorPlaceReviews");
  const end = providerSource.indexOf("export async function fetchFlickrPlacePhoto", start);
  const reviewsFn = providerSource.slice(start, end);
  assert.match(reviewsFn, /isTripAdvisorQuotaExceeded/);
  assert.match(reviewsFn, /recordTripAdvisorCall/);
  // Endpoint: free provider reviews (2GIS/Google) first; pay for TripAdvisor only when empty,
  // only on the full call (includePhoto), and only when the toggle is on.
  assert.match(endpointSource, /fetchPlaceIntelligence\([\s\S]*?withReviews: includePhoto/);
  assert.match(endpointSource, /providerResult\.data\?\.reviews \?\? \[\]/);
  assert.match(endpointSource, /includePhoto && reviews\.length === 0 && env\.TRIPADVISOR_REVIEWS_ENABLED/);
  assert.match(endpointSource, /fetchTripAdvisorPlaceReviews/);
});

test("carousel gallery is threaded through the media layer (reuses one photo call, cached, quota-free)", () => {
  assert.match(mediaSource, /gallery: photo\.gallery/);
  assert.match(mediaSource, /gallery: z\.array/);
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
