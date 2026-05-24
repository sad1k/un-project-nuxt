/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const modelSource = await readFile("lib/explore/place-intelligence.ts", "utf8").catch(() => "");
const providerSource = await readFile("lib/explore/place-intelligence-providers.ts", "utf8").catch(() => "");
const querySource = await readFile("lib/db/queries/place-intelligence.ts", "utf8").catch(() => "");
const endpointSource = await readFile("server/api/explore/place-intelligence.get.ts", "utf8").catch(() => "");
const envSource = await readFile("lib/env.ts", "utf8");

test("D-01 D-02 D-03 model exports a photo-first place intelligence contract with placeholders", () => {
  for (const exportName of [
    "PlaceIntelligenceSchema",
    "PlacePhotoSchema",
    "PlacePhotoSourceSchema",
    "PlaceReviewSnippetSchema",
    "PlaceRatingSchema",
    "PlaceCostSignalSchema",
    "PlaceCommunitySignalSchema",
    "PlaceWeatherReferenceSchema",
    "PlaceMissingDataSlotSchema",
    "PlaceDataSourceSchema",
    "buildPlaceIntelligence",
  ]) {
    assert.match(modelSource, new RegExp(`export (const|function) ${exportName}`));
  }

  assert.match(modelSource, /photo: PlacePhotoSchema\.nullable\(\)/);
  assert.match(modelSource, /source\.kind === "provider" \|\| source\.kind === "app"/);
  assert.doesNotMatch(modelSource, /source\.kind === "ai" \|\| source\.kind === "missing"/);
  assert.match(modelSource, /missingSlots/);
  for (const slot of ["photo", "reviews", "rating", "cost", "community"]) {
    assert.match(modelSource, new RegExp(`"${slot}"`));
  }
});

test("D-04 D-06 D-07 provider rating review cost fields keep source and confidence metadata", () => {
  assert.match(modelSource, /source: PlaceDataSourceSchema/);
  assert.match(modelSource, /confidence: RouteConfidenceSchema/);
  assert.match(modelSource, /reviews: z\.array\(PlaceReviewSnippetSchema\)/);
  assert.match(modelSource, /rating: PlaceRatingSchema\.nullable\(\)/);
  assert.match(modelSource, /cost: PlaceCostSignalSchema\.nullable\(\)/);
  assert.match(providerSource, /normalizeGooglePlaceDetails/);
  assert.match(providerSource, /priceLevel/);
});

test("D-05 AI summaries are enriched sourced content, not raw unsourced facts", () => {
  assert.match(modelSource, /aiSummary: z\.object/);
  assert.match(modelSource, /kind: z\.literal\("ai"\)/);
  assert.match(modelSource, /summarySource/);
  assert.doesNotMatch(modelSource, /rawProvider/);
  assert.doesNotMatch(endpointSource, /rawProvider/);
});

test("D-08 D-09 D-10 community signals are aggregate, uncertain, and identity-safe", () => {
  assert.match(modelSource, /likelyCurrentlyThere/);
  assert.match(modelSource, /recentWindowHours/);
  assert.match(querySource, /visitCount/);
  assert.match(querySource, /recentVisitCount/);
  assert.match(querySource, /likelyCurrentlyThere/);
  assert.match(querySource, /confidence: "low"/);
  assert.doesNotMatch(querySource, /return .*userId/s);
  assert.doesNotMatch(querySource, /description/);
});

test("server-only provider boundary keeps Google Places optional and explicitly field-masked", () => {
  assert.match(envSource, /GOOGLE_PLACES_API_KEY: z\.string\(\)\.optional\(\)/);
  assert.match(providerSource, /GOOGLE_PLACES_API_KEY/);
  assert.match(providerSource, /places\.googleapis\.com/);
  assert.match(providerSource, /X-Goog-FieldMask/);
  assert.match(providerSource, /GOOGLE_PLACES_LANGUAGE_CODE = "ru"/);
  assert.match(providerSource, /GOOGLE_PLACES_REGION_CODE = "RU"/);
  assert.match(providerSource, /languageCode: GOOGLE_PLACES_LANGUAGE_CODE/);
  assert.match(providerSource, /regionCode: GOOGLE_PLACES_REGION_CODE/);
  assert.match(providerSource, /fetch/);
  assert.match(providerSource, /available: false/);
  assert.match(providerSource, /env\.NODE_ENV === "production"/);
  assert.match(providerSource, /console\.warn\("\[google-place-photo\]"/);
  assert.doesNotMatch(providerSource, /console\.(log|debug|info|error)/);
  assert.doesNotMatch(providerSource, /rawProvider|providerHeaders|rawPayload/);
});

test("authenticated endpoint validates inputs, verifies route ownership, and returns shaped data", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /getValidatedQuery/);
  assert.match(endpointSource, /findAiRoutePointForPlaceIntelligence/);
  assert.match(endpointSource, /fetchGooglePlaceIntelligence/);
  assert.match(endpointSource, /findCommunityPlaceSignal/);
  assert.match(endpointSource, /buildPlaceIntelligence/);
  assert.doesNotMatch(endpointSource, /headers/);
});

test("place intelligence model stays pure and detached from UI, providers, database, env, and logging", () => {
  assert.doesNotMatch(modelSource, /\bref\(/);
  assert.doesNotMatch(modelSource, /\bcomputed\(/);
  assert.doesNotMatch(modelSource, /mapbox/i);
  assert.doesNotMatch(modelSource, /\bfetch\(/);
  assert.doesNotMatch(modelSource, /process\.env/);
  assert.doesNotMatch(modelSource, /console\./);
});
