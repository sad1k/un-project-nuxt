/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const querySource = await readFile("lib/db/queries/post.ts", "utf8");
const endpointSource = await readFile("server/api/public/feed-globe.get.ts", "utf8");

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker ${end}`);
  return source.slice(startIndex, endIndex);
}

test("public feed globe query uses only visible public coordinate-backed photo posts", () => {
  assert.match(querySource, /export async function getPublicFeedGlobePostRows/);
  assert.match(querySource, /eq\(locationLogImage\.visibility,\s*"public"\)/);
  assert.match(querySource, /eq\(locationLogImage\.moderationStatus,\s*"visible"\)/);
  assert.match(querySource, /isNotNull\(locationLogImage\.publishedAt\)/);
  assert.match(querySource, /isNotNull\(locationLogImage\.publicPlaceName\)/);
  assert.match(querySource, /isNotNull\(locationLogImage\.publicLat\)/);
  assert.match(querySource, /isNotNull\(locationLogImage\.publicLong\)/);
  assert.match(querySource, /innerJoin\(locationLogImage,\s*eq\(post\.locationLogImageId,\s*locationLogImage\.id\)\)/);
});

test("public feed globe serializer exposes popup-safe fields only", () => {
  const globeSource = sourceBetween(
    querySource,
    "export function serializePublicFeedGlobePost",
    "export async function getFeedPublishImageById",
  );

  assert.match(querySource, /export function serializePublicFeedGlobePost/);
  assert.match(globeSource, /image:\s*\{\s*url:/);
  assert.match(globeSource, /alt:\s*row\.publicPlaceName/);
  assert.match(globeSource, /place:\s*\{\s*name:\s*row\.publicPlaceName,\s*lat:\s*row\.publicLat,\s*long:\s*row\.publicLong/);
  assert.match(globeSource, /author:\s*\{\s*name:\s*row\.authorName,\s*image:\s*row\.authorImage/);
  assert.doesNotMatch(globeSource, /email:\s*user\.email/);
  assert.doesNotMatch(globeSource, /locationLogId:\s*locationLogImage\.locationLogId/);
  assert.doesNotMatch(globeSource, /description:\s*locationLogImage\.description/);
});

test("public feed globe endpoint is unauthenticated and maps storage keys to image URLs", () => {
  assert.doesNotMatch(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /getPublicFeedGlobePosts/);
  assert.match(endpointSource, /limit:\s*z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)\.default\(100\)/);
  assert.match(endpointSource, /since:\s*z\.coerce\.number\(\)\.int\(\)\.positive\(\)\.optional\(\)/);
  assert.match(endpointSource, /imageBaseUrl:\s*config\.public\.s3BucketUrl/);
  assert.match(endpointSource, /nextSince/);
  assert.doesNotMatch(endpointSource, /event\.context\.user|description|locationLogId|email/);
});
