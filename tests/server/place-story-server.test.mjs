/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const statusEndpointSource = await readFile("server/api/explore/place-story.get.ts", "utf8");
const generateEndpointSource = await readFile("server/api/explore/place-story/generate.post.ts", "utf8");
const audioEndpointSource = await readFile("server/api/explore/place-story/audio.get.ts", "utf8");
const providerSource = await readFile("lib/explore/place-story-provider.ts", "utf8");

test("place story status endpoint authenticates and validates route point ownership", () => {
  assert.match(statusEndpointSource, /defineAuthenticatedHandler/);
  assert.match(statusEndpointSource, /getValidatedQuery/);
  assert.match(statusEndpointSource, /PlaceStoryRequestSchema\.parse/);
  assert.match(statusEndpointSource, /findRoutePointForPlaceStory\(event\.context\.user\.id,\s*query\)/);
  assert.match(statusEndpointSource, /findRoutePlaceStory/);
  assert.match(statusEndpointSource, /createReadyPlaceStoryResponse/);
});

test("place story generation endpoint is explicit, idempotent, and support-gated", () => {
  assert.match(generateEndpointSource, /readValidatedBody/);
  assert.match(generateEndpointSource, /PlaceStoryRequestSchema\.safeParse/);
  assert.match(generateEndpointSource, /findRoutePointForPlaceStory\(event\.context\.user\.id,\s*request\)/);
  assert.match(generateEndpointSource, /existing\?\.audioObjectKey/);
  assert.match(generateEndpointSource, /buildPlaceIntelligenceForStory/);
  assert.match(generateEndpointSource, /evaluatePlaceStorySupport/);
  assert.match(generateEndpointSource, /if \(!support\.supported\)/);
  assert.match(generateEndpointSource, /saveRoutePlaceStoryUnavailable/);
  assert.match(generateEndpointSource, /generatePlaceStoryAudio/);
  assert.match(generateEndpointSource, /saveRoutePlaceStoryAudio/);
});

test("story audio endpoint streams audio only through authenticated owned story metadata", () => {
  assert.match(audioEndpointSource, /defineAuthenticatedHandler/);
  assert.match(audioEndpointSource, /getValidatedQuery/);
  assert.match(audioEndpointSource, /findRoutePointForPlaceStory\(event\.context\.user\.id,\s*query\)/);
  assert.match(audioEndpointSource, /findRoutePlaceStory/);
  assert.match(audioEndpointSource, /story\?\.audioObjectKey/);
  assert.match(audioEndpointSource, /readPlaceStoryAudioObject/);
  assert.match(audioEndpointSource, /cache-control/);
  assert.doesNotMatch(audioEndpointSource, /S3_SECRET_KEY|OPENAI_API_KEY|Authorization/);
});

test("story provider stores route-scoped audio objects without public object URLs", () => {
  assert.match(providerSource, /createPlaceStoryAudioObjectKey/);
  assert.match(providerSource, /place-stories/);
  assert.match(providerSource, /userId/);
  assert.match(providerSource, /sessionId/);
  assert.match(providerSource, /variantId/);
  assert.match(providerSource, /routePointId/);
  assert.match(providerSource, /PutObjectCommand/);
  assert.match(providerSource, /GetObjectCommand/);
  assert.doesNotMatch(providerSource, /S3_BUCKET_URL/);
});
