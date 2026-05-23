/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const densitySource = await readFile("lib/feed/globe-density.ts", "utf8");

test("density helper is pure and configurable", () => {
  assert.match(densitySource, /export function limitFeedGlobeDensity/);
  assert.match(densitySource, /maxVisiblePerBucket = options\.maxVisiblePerBucket \?\? DEFAULT_MAX_VISIBLE_PER_BUCKET/);
  assert.match(densitySource, /bucketSizeDegrees = options\.bucketSizeDegrees \?\? DEFAULT_BUCKET_SIZE_DEGREES/);
  assert.doesNotMatch(densitySource, /window|document|mapbox|fetch\(/);
});

test("density helper keeps newest points first", () => {
  assert.match(densitySource, /sort\(compareNewestFirst\)/);
  assert.match(densitySource, /return b\.createdAt - a\.createdAt/);
  assert.match(densitySource, /return b\.id - a\.id/);
});

test("density helper caps visible points and treats hidden points as fading", () => {
  assert.match(densitySource, /const visible = sorted\.slice\(0,\s*maxVisiblePerBucket\)/);
  assert.match(densitySource, /const hidden = sorted\.slice\(maxVisiblePerBucket\)/);
  assert.match(densitySource, /hiddenPointIds\.push\(\.\.\.hidden\.map\(point => point\.id\)\)/);
  assert.match(densitySource, /fadingPointIds\.push\(\.\.\.hidden\.map\(point => point\.id\)\)/);
});

test("density helper emits overflow indicators with hidden counts", () => {
  assert.match(densitySource, /overflowIndicators\.push\(\{/);
  assert.match(densitySource, /hiddenCount:\s*hidden\.length/);
  assert.match(densitySource, /id:\s*`\$\{bucketKey\}:overflow`/);
  assert.match(densitySource, /lat:\s*anchor\.lat/);
  assert.match(densitySource, /long:\s*anchor\.long/);
});

test("bucket key groups points by rounded local radius", () => {
  assert.match(densitySource, /export function getFeedGlobeBucketKey/);
  assert.match(densitySource, /Math\.floor\(\(point\.lat \+ 90\) \/ bucketSizeDegrees\)/);
  assert.match(densitySource, /Math\.floor\(\(point\.long \+ 180\) \/ bucketSizeDegrees\)/);
});
