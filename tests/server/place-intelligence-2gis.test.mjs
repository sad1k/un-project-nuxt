/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const providerSource = await readFile("lib/explore/place-intelligence-providers.ts", "utf8");
const endpointSource = await readFile("server/api/explore/place-intelligence.get.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("place intelligence dispatcher prefers 2GIS with Google as fallback", () => {
  assert.match(providerSource, /export async function fetchPlaceIntelligence/);
  assert.match(providerSource, /export async function fetch2GisPlaceIntelligence/);

  const twoGisCall = providerSource.indexOf("fetch2GisPlaceIntelligence(input");
  const googleFallback = providerSource.indexOf("return fetchGooglePlaceIntelligence(input)");
  assert.ok(twoGisCall >= 0, "dispatcher should call the 2GIS provider");
  assert.ok(googleFallback > twoGisCall, "Google should run only as the fallback after 2GIS");

  // The endpoint must consume the provider-agnostic dispatcher, not Google directly.
  assert.match(endpointSource, /fetchPlaceIntelligence/);

  // Review text is only fetched for the full panel/sheet (withReviews), not the light popup.
  assert.match(providerSource, /options: \{ withReviews\?: boolean \}/);
  assert.match(providerSource, /options\.withReviews/);
  assert.match(providerSource, /fetch2GisBranchReviews\(/);
});

test("2GIS provider hits the public Catalog API and is gated on its own optional key", () => {
  assert.match(envSource, /TWOGIS_API_KEY: z\.string\(\)\.optional\(\)/);
  assert.match(envSource, /TWOGIS_REVIEWS_API_KEY: z\.string\(\)\.optional\(\)/);
  assert.match(envSource, /TRIPADVISOR_REVIEWS_ENABLED: EnvBooleanSchema/);
  assert.match(providerSource, /TWOGIS_API_KEY/);
  assert.match(providerSource, /catalog\.api\.2gis\.com\/3\.0\/items/);
  assert.match(providerSource, /items\.reviews/);
  assert.match(providerSource, /twogis_not_configured/);
});

test("2GIS normalizer maps the reviews block to a rating signal only", () => {
  assert.match(providerSource, /export function normalize2GisPlace/);
  assert.match(providerSource, /function normalize2GisRating/);
  assert.match(providerSource, /general_rating/);
  assert.match(providerSource, /review_count/);
});

test("2GIS provider keeps the server-only logging boundary", () => {
  assert.match(providerSource, /console\.warn\("\[2gis-place\]"/);
  assert.doesNotMatch(providerSource, /console\.(log|debug|info|error)/);
});

test("2GIS review text comes from the unofficial reviews endpoint, fail-soft", () => {
  assert.match(providerSource, /export async function fetch2GisBranchReviews/);
  assert.match(providerSource, /public-api\.reviews\.2gis\.com\/2\.0\/branches/);
  // Key: env override falling back to the in-code public default.
  assert.match(providerSource, /TWOGIS_REVIEWS_API_KEY \|\| TWOGIS_REVIEWS_PUBLIC_KEY/);
  // Normalizes text/rating/author/date and skips hidden / on-moderation / empty-text reviews.
  assert.match(providerSource, /is_hidden/);
  assert.match(providerSource, /on_moderation/);
  assert.match(providerSource, /date_created/);
  assert.match(providerSource, /label: "2ГИС"/);
  // Timeout + browser-like UA (the endpoint 403s otherwise).
  assert.match(providerSource, /TWOGIS_REVIEWS_TIMEOUT_MS/);
  assert.match(providerSource, /User-Agent/);
  // Server-only logging boundary: warn only, dedicated tag.
  assert.match(providerSource, /console\.warn\("\[2gis-reviews\]"/);
});
