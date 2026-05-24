/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const endpointSource = await readFile("server/api/ai/route/[session-id].get.ts", "utf8");
const querySource = await readFile("lib/db/queries/ai-route.ts", "utf8");
const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");

test("route restore endpoint reads only authenticated user-owned sessions", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /getRouterParam/);
  assert.match(endpointSource, /findAiRouteSessionByIdForUser/);
  assert.match(endpointSource, /event\.context\.user\.id/);
  assert.match(querySource, /eq\(aiRouteSession\.id, sessionId\)/);
  assert.match(querySource, /eq\(aiRouteSession\.userId, userId\)/);
});

test("route restore endpoint returns map-ready session snapshots", () => {
  assert.match(endpointSource, /ExploreRequestContextSchema/);
  assert.match(endpointSource, /RouteEventEnvelopeSchema/);
  assert.match(endpointSource, /RoutePointSchema/);
  assert.match(endpointSource, /pointsByVariantId/);
  assert.match(endpointSource, /activeVariantId/);
  assert.match(endpointSource, /requestContext/);
});

test("client stores and restores the active route session after reloads", () => {
  assert.match(sessionSource, /ROUTE_SESSION_STORAGE_KEY/);
  assert.match(sessionSource, /persistRouteSessionReference/);
  assert.match(sessionSource, /restoreRouteSession/);
  assert.match(sessionSource, /applyRouteSessionSnapshot/);
  assert.match(sessionSource, /Генерация маршрута была прервана/);
});
