/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const streamEndpointSource = await readFile("server/api/public/feed-globe/stream.get.ts", "utf8");
const globeComposableSource = await readFile("composables/use-feed-globe.ts", "utf8");
const globeComponentSource = await readFile("components/feed/feed-globe.client.vue", "utf8");

test("public feed globe stream is unauthenticated and uses the safe serializer", () => {
  assert.doesNotMatch(streamEndpointSource, /defineAuthenticatedHandler/);
  assert.match(streamEndpointSource, /createEventStream/);
  assert.match(streamEndpointSource, /getPublicFeedGlobePosts/);
  assert.match(streamEndpointSource, /imageBaseUrl:\s*config\.public\.s3BucketUrl/);
  assert.doesNotMatch(streamEndpointSource, /description|locationLogId|email|provider|routeContext/);
});

test("stream endpoint supports since cursor and cleans up connections", () => {
  assert.match(streamEndpointSource, /since:\s*z\.coerce\.number\(\)\.int\(\)\.nonnegative\(\)\.default\(0\)/);
  assert.match(streamEndpointSource, /STREAM_INTERVAL_MS/);
  assert.match(streamEndpointSource, /setInterval/);
  assert.match(streamEndpointSource, /eventStream\.onClosed/);
  assert.match(streamEndpointSource, /clearInterval\(interval\)/);
  assert.match(streamEndpointSource, /eventStream\.close\(\)/);
});

test("client uses EventSource with polling fallback", () => {
  assert.match(globeComposableSource, /startLiveUpdates/);
  assert.match(globeComposableSource, /new EventSource\(`\/api\/public\/feed-globe\/stream\?since=\$\{nextSince\.value\}`\)/);
  assert.match(globeComposableSource, /eventSource\.onmessage/);
  assert.match(globeComposableSource, /eventSource\.onerror/);
  assert.match(globeComposableSource, /startPollingFallback/);
  assert.match(globeComposableSource, /fetchNewPosts/);
  assert.match(globeComposableSource, /\/api\/public\/feed-globe\?\$\{params\.toString\(\)\}/);
});

test("live and polling arrivals deduplicate and reuse density limiting", () => {
  assert.match(globeComposableSource, /const byId = new Map<number, PublicFeedGlobePost>/);
  assert.match(globeComposableSource, /byId\.set\(post\.id,\s*post\)/);
  assert.match(globeComposableSource, /applyDensity\(\)/);
  assert.match(globeComposableSource, /limitFeedGlobeDensity/);
});

test("globe component starts and stops live updates with lifecycle", () => {
  assert.match(globeComponentSource, /globe\.startLiveUpdates\(\)/);
  assert.match(globeComponentSource, /globe\.stopLiveUpdates\(\)/);
});
