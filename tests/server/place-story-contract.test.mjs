/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const contractSource = await readFile("lib/explore/place-story.ts", "utf8");
const providerSource = await readFile("lib/explore/place-story-provider.ts", "utf8");
const schemaSource = await readFile("lib/db/schema/route-place-story.ts", "utf8");
const schemaIndexSource = await readFile("lib/db/schema/index.ts", "utf8");
const querySource = await readFile("lib/db/queries/route-place-story.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("place story contract exposes route-scoped status, source support, and audio metadata", () => {
  for (const exportName of [
    "PlaceStoryStatusSchema",
    "PlaceStoryFailureCodeSchema",
    "PlaceStorySourceSupportSchema",
    "PlaceStoryAudioSchema",
    "PlaceStoryRequestSchema",
    "PlaceStoryResponseSchema",
  ]) {
    assert.match(contractSource, new RegExp(`export const ${exportName}`));
  }

  for (const status of ["ready", "available", "unavailable", "generating", "failed"]) {
    assert.match(contractSource, new RegExp(`"${status}"`));
  }

  for (const field of ["sessionId", "variantId", "routePointId", "sourceNote", "disclosure", "cacheKey"]) {
    assert.match(contractSource, new RegExp(field));
  }
});

test("place story contract is audio-first and does not expose transcript or story body", () => {
  assert.match(contractSource, /PLACE_STORY_DISCLOSURE/);
  assert.match(contractSource, /default_only/);
  assert.doesNotMatch(contractSource, /transcript/i);
  assert.doesNotMatch(contractSource, /storyText|storyBody|fullText/);
  assert.doesNotMatch(contractSource, /voiceSelector|languageSelector/);
});

test("route place story schema persists audio metadata with route ownership and idempotency", () => {
  assert.match(schemaSource, /export const routePlaceStory/);

  for (const column of [
    "userId",
    "sessionId",
    "variantId",
    "routePointId",
    "status",
    "failureCode",
    "sourceSupportJson",
    "voiceId",
    "audioObjectKey",
    "audioContentType",
    "audioByteLength",
  ]) {
    assert.match(schemaSource, new RegExp(column));
  }

  assert.match(schemaSource, /aiRouteSession/);
  assert.match(schemaSource, /aiRouteVariant/);
  assert.match(schemaSource, /unique\(\)\.on\(t\.userId,\s*t\.sessionId,\s*t\.variantId,\s*t\.routePointId\)/);
  assert.match(schemaIndexSource, /route-place-story/);
});

test("route place story queries verify user-owned session variant and point before status writes", () => {
  assert.match(querySource, /export async function findRoutePointForPlaceStory/);
  assert.match(querySource, /eq\(aiRoutePoint\.userId,\s*userId\)/);
  assert.match(querySource, /eq\(aiRoutePoint\.variantId,\s*input\.variantId\)/);
  assert.match(querySource, /eq\(aiRoutePoint\.routePointId,\s*input\.routePointId\)/);
  assert.match(querySource, /point\.variant\.sessionId !== input\.sessionId/);
  assert.match(querySource, /saveRoutePlaceStoryUnavailable/);
  assert.match(querySource, /saveRoutePlaceStoryAudio/);
});

test("story provider grounds narration and refuses weak facts before TTS", () => {
  assert.match(providerSource, /evaluatePlaceStorySupport/);
  assert.match(providerSource, /insufficient_place_facts/);
  assert.match(providerSource, /hasProviderFacts && Boolean\(place\.routeRationale\)/);
  assert.match(providerSource, /throw new PlaceStoryProviderError\("insufficient_place_facts"\)/);
  assert.match(providerSource, /fetchGooglePlaceIntelligence/);
  assert.match(providerSource, /findCommunityPlaceSignal/);
  assert.doesNotMatch(providerSource, /console\./);
});

test("TTS integration uses native fetch and keeps provider credentials server-only", () => {
  assert.match(envSource, /OPENAI_TTS_MODEL: z\.string\(\)\.default\("gpt-4o-mini-tts"\)/);
  assert.match(envSource, /OPENAI_TTS_VOICE: z\.string\(\)\.default\("coral"\)/);
  assert.match(providerSource, /fetch\(`\$\{getOpenAiBaseUrl\(\)\}\/audio\/speech`/);
  assert.match(providerSource, /Authorization/);
  assert.match(providerSource, /OPENAI_API_KEY/);
  assert.match(providerSource, /response_format: "mp3"/);
  assert.match(providerSource, /new S3Client/);
  assert.doesNotMatch(contractSource, /OPENAI_API_KEY|S3_SECRET_KEY|Authorization/);
});
