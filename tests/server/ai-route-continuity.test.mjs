/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const endpointSource = await readFile("server/api/ai/route.post.ts", "utf8");
const runnerSource = await readFile("lib/ai/route-generation-runner.ts", "utf8");
const querySource = await readFile("lib/db/queries/ai-route.ts", "utf8");
const schemaSource = await readFile("lib/db/schema/ai-route.ts", "utf8");

test("route POST endpoint starts a durable generation runner outside the client stream", () => {
  assert.match(endpointSource, /runRouteGeneration/);
  assert.match(endpointSource, /new TransformStream/);
  assert.match(endpointSource, /event\.waitUntil\?\.\(runPromise\)/);
  assert.match(endpointSource, /serializeRouteEventSse/);
  assert.match(endpointSource, /streamClosed/);
  assert.doesNotMatch(endpointSource, /fetchOpenAiCompatibleRouteStream/);
  assert.doesNotMatch(endpointSource, /ReadableStream<Uint8Array>/);
});

test("route generation runner owns provider parsing, persistence, and completion state", () => {
  assert.match(runnerSource, /export async function runRouteGeneration/);
  assert.match(runnerSource, /RouteEventEnvelopeSchema\.safeParse/);
  assert.match(runnerSource, /fetchOpenAiCompatibleRouteStream/);
  assert.match(runnerSource, /createMockAiRouteEventStream/);
  assert.match(runnerSource, /persistAiRouteEvent/);
  assert.match(runnerSource, /persistAiRoutePoint/);
  assert.match(runnerSource, /markAiRouteVariantCompleted/);
  assert.match(runnerSource, /markAiRouteVariantFailed/);
  assert.match(runnerSource, /refreshAiRouteGenerationHeartbeat/);
  assert.match(runnerSource, /claimAiRouteGenerationRun/);
  assert.match(runnerSource, /ai\.route_generation\.no_valid_route_points/);
  assert.match(runnerSource, /ai\.route_generation\.started/);
  assert.match(runnerSource, /ai\.route_generation\.completed/);
  assert.match(runnerSource, /logSafeServerEvent/);
  assert.doesNotMatch(runnerSource, /bufferedTextPreview/);
  assert.doesNotMatch(runnerSource, /requestContextJson/);
  assert.doesNotMatch(runnerSource, /payloadJson/);
  assert.doesNotMatch(runnerSource, /providerBodyPreview/);
  assert.doesNotMatch(runnerSource, /Authorization/);
});

test("route generation lifecycle is persisted for cross-page status", () => {
  for (const column of [
    "generationStartedAt",
    "generationHeartbeatAt",
    "generationCompletedAt",
    "runnerId",
    "notificationStatus",
    "retryCount",
  ]) {
    assert.match(schemaSource, new RegExp(column));
    assert.match(querySource, new RegExp(column));
  }

  assert.match(querySource, /markAiRouteNotificationStatus/);
  assert.match(querySource, /findAiRouteSessionSummariesByUserId/);
});
