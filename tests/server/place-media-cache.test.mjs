/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const mediaSource = await readFile("lib/explore/place-media.ts", "utf8").catch(() => "");
const schemaSource = await readFile("lib/db/schema/place-media-cache.ts", "utf8").catch(() => "");
const schemaIndexSource = await readFile("lib/db/schema/index.ts", "utf8");
const querySource = await readFile("lib/db/queries/place-media-cache.ts", "utf8").catch(() => "");

test("place media contract allows real media sources only", () => {
  assert.match(mediaSource, /PlaceMediaSourceSchema/);
  for (const source of ["app", "google", "wikimedia", "foursquare"]) {
    assert.match(mediaSource, new RegExp(`"${source}"`));
  }
  for (const blocked of ["ai", "generated", "stock", "illustrative"]) {
    assert.doesNotMatch(mediaSource, new RegExp(`"${blocked}"`));
    assert.doesNotMatch(schemaSource, new RegExp(`"${blocked}"`));
  }
  assert.doesNotMatch(mediaSource, /source:\s*"missing"/);
});

test("place media result is photo-or-missing and keeps source metadata", () => {
  assert.match(mediaSource, /PlaceMediaResolutionResultSchema/);
  assert.match(mediaSource, /z\.discriminatedUnion\("status"/);
  assert.match(mediaSource, /z\.literal\("photo"\)/);
  assert.match(mediaSource, /z\.literal\("missing"\)/);
  assert.match(mediaSource, /attribution/);
  assert.match(mediaSource, /licenseHint/);
  assert.match(mediaSource, /termsHint/);
  assert.match(mediaSource, /expiresAt/);
  assert.match(mediaSource, /matchConfidence/);
});

test("place media cache schema stores metadata expiry and failure state only", () => {
  assert.match(schemaSource, /sqliteTable\("placeMediaCache"/);
  for (const field of [
    "placeKey",
    "source",
    "providerPlaceId",
    "providerPhotoReference",
    "photoUrl",
    "attribution",
    "licenseHint",
    "termsHint",
    "expiresAt",
    "failedAt",
    "failureCode",
    "matchConfidence",
  ]) {
    assert.match(schemaSource, new RegExp(`${field}:`));
  }
  assert.match(schemaIndexSource, /export \* from "\.\/place-media-cache"/);
});

test("place media cache avoids secrets raw provider payloads and private route context", () => {
  for (const source of [mediaSource, schemaSource, querySource]) {
    assert.doesNotMatch(source, /apiKey|GOOGLE_PLACES_API_KEY|S3_SECRET_KEY|OPENAI_API_KEY/);
    assert.doesNotMatch(source, /providerHeaders|rawProvider|rawPayload|payloadJson/);
    assert.doesNotMatch(source, /prompt|requestContextJson|diaryText|privateRouteContext/);
  }
});

test("place media cache queries expose fresh get upsert and failure helpers", () => {
  for (const exportName of [
    "getFreshPlaceMediaCacheEntry",
    "upsertPlaceMediaCacheEntry",
    "recordPlaceMediaCacheFailure",
    "markPlaceMediaCacheStale",
  ]) {
    assert.match(querySource, new RegExp(`export async function ${exportName}`));
  }
  assert.match(querySource, /gt\(placeMediaCache\.expiresAt,\s*Date\.now\(\)\)/);
  assert.match(querySource, /onConflictDoUpdate/);
});
