/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const providerSource = await readFile("lib/ai/openai-compatible.ts", "utf8");
const mockSource = await readFile("lib/ai/mock-route-stream.ts", "utf8");
const endpointSource = await readFile("server/api/ai/route.post.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("OpenAI-compatible client exposes streaming parser and response fetch", () => {
  assert.match(providerSource, /fetchOpenAiCompatibleRouteStream/);
  assert.match(providerSource, /parseOpenAiSseLines/);
  assert.match(providerSource, /\/responses/);
  assert.match(providerSource, /stream: true/);
});

test("provider parser handles multiple data events and done markers in source", () => {
  assert.match(providerSource, /split\(\/\\r\?\\n\\r\?\\n\/\)/);
  assert.match(providerSource, /\[DONE\]/);
  assert.match(providerSource, /JSON\.parse\(line\)/);
});

test("stream endpoint authenticates, validates, persists, and emits app route events", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /event\.context\.user\.id/);
  assert.match(endpointSource, /RouteGenerationRequestSchema/);
  assert.match(endpointSource, /RouteEventEnvelopeSchema\.safeParse/);
  assert.match(endpointSource, /persistAiRouteEvent/);
  assert.match(endpointSource, /persistAiRoutePoint/);
  assert.match(endpointSource, /text\/event-stream/);
});

test("stream endpoint supports server-side mock route events", () => {
  assert.match(envSource, /AI_ROUTE_MOCK_ENABLED/);
  assert.match(endpointSource, /AI_ROUTE_MOCK_ENABLED/);
  assert.match(endpointSource, /createMockAiRouteEventStream/);
  assert.match(mockSource, /route\.point\.added/);
  assert.match(mockSource, /route\.variant\.completed/);
  assert.match(mockSource, /MOCK_STREAM_DELAY_MS/);
});

test("OpenAI provider config stays server-only and unlogged", () => {
  assert.doesNotMatch(providerSource, /runtimeConfig\.public/);
  assert.doesNotMatch(providerSource, /console\./);
  assert.doesNotMatch(endpointSource, /console\./);
  assert.doesNotMatch(endpointSource, /OPENAI_API_KEY/);
});
