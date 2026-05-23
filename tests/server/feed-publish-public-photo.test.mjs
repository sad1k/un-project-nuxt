/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const querySource = await readFile("lib/db/queries/post.ts", "utf8");
const publishEndpointSource = await readFile("server/api/posts/index.post.ts", "utf8");
const myImagesEndpointSource = await readFile("server/api/posts/my-images.get.ts", "utf8");
const publishPageSource = await readFile("pages/dashboard/publish.vue", "utf8");

test("feed publishing validates owner image before creating a post", () => {
  assert.match(querySource, /export async function getFeedPublishImageById/);
  assert.match(querySource, /eq\(locationLogImage\.id,\s*locationLogImageId\)/);
  assert.match(querySource, /eq\(locationLogImage\.userId,\s*userId\)/);
  assert.match(publishEndpointSource, /defineAuthenticatedHandler/);
  assert.match(publishEndpointSource, /getFeedPublishImageById\(locationLogImageId,\s*event\.context\.user\.id\)/);
  assert.match(publishEndpointSource, /statusCode:\s*404/);
});

test("feed publishing requires public visible coordinate-backed photos", () => {
  assert.match(querySource, /export function isFeedPublishImageEligible/);
  assert.match(querySource, /image\.visibility === "public"/);
  assert.match(querySource, /image\.moderationStatus === "visible"/);
  assert.match(querySource, /image\.publishedAt !== null/);
  assert.match(querySource, /!!image\.publicPlaceName/);
  assert.match(querySource, /image\.publicLat !== null/);
  assert.match(querySource, /image\.publicLong !== null/);
  assert.match(publishEndpointSource, /isFeedPublishImageEligible\(image\)/);
  assert.match(publishEndpointSource, /statusCode:\s*422/);
});

test("duplicate feed post conflict behavior is preserved", () => {
  assert.match(publishEndpointSource, /UNIQUE constraint failed/);
  assert.match(publishEndpointSource, /statusCode:\s*409/);
  assert.match(publishEndpointSource, /createPost\(locationLogImageId,\s*event\.context\.user\.id,\s*caption\)/);
});

test("publish image picker returns public readiness metadata", () => {
  assert.match(querySource, /export async function getUserFeedPublishImages/);
  assert.match(querySource, /visibility:\s*locationLogImage\.visibility/);
  assert.match(querySource, /publicPlaceName:\s*locationLogImage\.publicPlaceName/);
  assert.match(querySource, /publicLat:\s*locationLogImage\.publicLat/);
  assert.match(querySource, /publicLong:\s*locationLogImage\.publicLong/);
  assert.match(querySource, /moderationStatus:\s*locationLogImage\.moderationStatus/);
  assert.match(querySource, /isPosted:\s*sql<boolean>`EXISTS\(SELECT 1 FROM \$\{post\}/);
  assert.match(myImagesEndpointSource, /getUserFeedPublishImages/);
  assert.doesNotMatch(myImagesEndpointSource, /defineEventHandler/);
});

test("publish page can prefill caption from feed composer draft", () => {
  assert.match(publishPageSource, /useRoute\(\)/);
  assert.match(publishPageSource, /route\.query\.caption/);
  assert.match(publishPageSource, /caption\.value = route\.query\.caption\.slice\(0, 500\)/);
});
