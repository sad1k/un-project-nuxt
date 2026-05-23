/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaSource = await readFile("lib/db/schema/location-log-image.ts", "utf8");
const querySource = await readFile("lib/db/queries/location-log-image.ts", "utf8");
const publicEndpointSource = await readFile("server/api/public/place-photos.get.ts", "utf8");
const visibilityEndpointSource = await readFile(
  "server/api/locations/[slug]/[id]/images/[image-id]/visibility.patch.ts",
  "utf8",
);

test("location log images default to private public-photo metadata", () => {
  assert.match(schemaSource, /export const publicPhotoVisibilityValues = \["private", "public"\] as const/);
  assert.match(schemaSource, /visibility:\s*text\(\{\s*enum:\s*publicPhotoVisibilityValues\s*\}\)\.notNull\(\)\.default\("private"\)/);
  assert.match(schemaSource, /publicPlaceName:\s*text\(\)/);
  assert.match(schemaSource, /publicLat:\s*real\(\)/);
  assert.match(schemaSource, /publicLong:\s*real\(\)/);
  assert.match(schemaSource, /publishedAt:\s*int\(\)/);
  assert.match(schemaSource, /moderationStatus:\s*text\(\{\s*enum:\s*publicPhotoModerationStatusValues\s*\}\)\.notNull\(\)\.default\("visible"\)/);
  assert.match(schemaSource, /locationAccuracy:\s*real\(\)/);
  assert.match(schemaSource, /locationSource:\s*text\(\{\s*enum:\s*publicPhotoLocationSourceValues\s*\}\)/);
});

test("initial diary image inserts cannot publish public metadata implicitly", () => {
  assert.match(schemaSource, /visibility:\s*true/);
  assert.match(schemaSource, /publicPlaceName:\s*true/);
  assert.match(schemaSource, /publicLat:\s*true/);
  assert.match(schemaSource, /publicLong:\s*true/);
  assert.match(schemaSource, /publishedAt:\s*true/);
  assert.match(schemaSource, /moderationStatus:\s*true/);
});

test("public photo queries expose only visible public snapshots", () => {
  assert.match(querySource, /export async function listPublicPlacePhotos/);
  assert.match(querySource, /eq\(locationLogImage\.visibility,\s*"public"\)/);
  assert.match(querySource, /eq\(locationLogImage\.moderationStatus,\s*"visible"\)/);
  assert.match(querySource, /isNotNull\(locationLogImage\.publishedAt\)/);
  assert.match(querySource, /publicPlaceName:\s*locationLogImage\.publicPlaceName/);
  assert.match(querySource, /authorName:\s*user\.name/);
  assert.doesNotMatch(querySource, /description:\s*locationLogImage\.description/);
});

test("owner visibility mutation is explicit and does not use feed posts", () => {
  assert.match(querySource, /export async function makeLocationLogImagePublic/);
  assert.match(querySource, /export async function makeLocationLogImagePrivate/);
  assert.match(querySource, /eq\(locationLogImage\.id,\s*imageId\)/);
  assert.match(querySource, /eq\(locationLogImage\.userId,\s*userId\)/);
  assert.match(querySource, /publishedAt:\s*Date\.now\(\)/);
  assert.match(querySource, /visibility:\s*"private"/);
  assert.doesNotMatch(querySource, /createPost|post\./);
});

test("public place-photo endpoint is unauthenticated and omits private diary text", () => {
  assert.doesNotMatch(publicEndpointSource, /defineAuthenticatedHandler/);
  assert.match(publicEndpointSource, /listPublicPlacePhotos/);
  assert.match(publicEndpointSource, /north/);
  assert.match(publicEndpointSource, /south/);
  assert.match(publicEndpointSource, /east/);
  assert.match(publicEndpointSource, /west/);
  assert.match(publicEndpointSource, /photos:\s*photos\.map/);
  assert.doesNotMatch(publicEndpointSource, /description|locationLogId|userId/);
});

test("visibility endpoint is authenticated and validates public snapshots", () => {
  assert.match(visibilityEndpointSource, /defineAuthenticatedHandler/);
  assert.match(visibilityEndpointSource, /visibility:\s*z\.literal\("public"\)/);
  assert.match(visibilityEndpointSource, /publicPlaceName:\s*z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(visibilityEndpointSource, /publicLat:\s*z\.number\(\)\.min\(-90\)\.max\(90\)/);
  assert.match(visibilityEndpointSource, /publicLong:\s*z\.number\(\)\.min\(-180\)\.max\(180\)/);
  assert.match(visibilityEndpointSource, /makeLocationLogImagePublic/);
  assert.match(visibilityEndpointSource, /makeLocationLogImagePrivate/);
  assert.doesNotMatch(visibilityEndpointSource, /createPost|post\./);
});
