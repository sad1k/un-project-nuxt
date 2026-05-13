/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const searchSource = await readFile("lib/explore/search.ts", "utf8");
const contextSource = await readFile("lib/explore/context.ts", "utf8");
const suggestSource = await readFile("server/api/explore/city-suggest.get.ts", "utf8");
const fallbackSource = await readFile("server/api/search-locations.get.ts", "utf8");

test("Explore search helpers normalize both Mapbox and Nominatim providers", () => {
  assert.match(searchSource, /normalizeMapboxSuggestions/);
  assert.match(searchSource, /normalizeMapboxFeature/);
  assert.match(searchSource, /normalizeNominatimResults/);
  assert.match(searchSource, /normalizeNominatimResult/);
  assert.match(searchSource, /provider: "mapbox"/);
  assert.match(searchSource, /provider: "nominatim"/);
});

test("Explore context is serializable and detached from Vue refs", () => {
  assert.match(contextSource, /ExploreRequestContext/);
  assert.match(contextSource, /selectedSavedPlaceIds: number\[\]/);
  assert.match(contextSource, /selectedDiaryLogIds: number\[\]/);
  assert.doesNotMatch(contextSource, /\bref\(/);
  assert.doesNotMatch(contextSource, /\bcomputed\(/);
});

test("City suggestion endpoints use URLSearchParams instead of raw query interpolation", () => {
  assert.match(suggestSource, /URLSearchParams/);
  assert.match(fallbackSource, /URLSearchParams/);
  assert.doesNotMatch(fallbackSource, /search\?q=\$\{/);
});

test("Nominatim fallback route avoids debug logging and normalizes cache keys", () => {
  assert.doesNotMatch(fallbackSource, /console\.log/);
  assert.match(fallbackSource, /getExploreSearchCacheKey/);
});
