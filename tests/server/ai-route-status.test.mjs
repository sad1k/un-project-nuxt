/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const endpointSource = await readFile("server/api/ai/route-sessions.get.ts", "utf8");
const deleteEndpointSource = await readFile("server/api/ai/route/[session-id].delete.ts", "utf8");
const restoreSource = await readFile("server/api/ai/route/[session-id].get.ts", "utf8");
const querySource = await readFile("lib/db/queries/ai-route.ts", "utf8");
const statusSource = await readFile("composables/use-route-generation-status.ts", "utf8");
const indicatorSource = await readFile("components/app/route-generation-indicator.vue", "utf8");
const navSource = await readFile("components/app/nav-bar.vue", "utf8");
const exploreSource = await readFile("pages/explore.vue", "utf8");
const historySource = await readFile("components/explore/route-history.vue", "utf8");

test("route session status endpoint returns authenticated summaries and stale state", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /findAiRouteSessionSummariesByUserId/);
  assert.match(endpointSource, /event\.context\.user\.id/);
  assert.match(endpointSource, /activeOnly/);
  assert.match(endpointSource, /STALE_GENERATION_MS/);
  assert.match(endpointSource, /isStale/);
  assert.match(endpointSource, /displayStatus/);
});

test("restore snapshots include lifecycle status needed after navigation", () => {
  assert.match(restoreSource, /generationStartedAt/);
  assert.match(restoreSource, /generationHeartbeatAt/);
  assert.match(restoreSource, /generationCompletedAt/);
  assert.match(restoreSource, /notificationStatus/);
  assert.match(restoreSource, /failureCode/);
});

test("client polls route generation status and exposes global indicator state", () => {
  assert.match(statusSource, /\/api\/ai\/route-sessions/);
  assert.match(statusSource, /startRouteGenerationStatusPolling/);
  assert.match(statusSource, /setInterval/);
  assert.match(statusSource, /activeGenerationSessions/);
  assert.match(statusSource, /status\s*===\s*"generating"\s*&&\s*!session\.isStale/);
  assert.match(statusSource, /latestCompletedSession/);
  assert.match(statusSource, /latestStaleGenerationSession/);
  assert.match(indicatorSource, /useRouteGenerationStatus/);
  assert.match(indicatorSource, /NuxtLink/);
  assert.match(indicatorSource, /sessionId/);
  assert.match(indicatorSource, /displayStatus/);
  assert.match(indicatorSource, /route stalled/);
  assert.match(indicatorSource, /getSessionIcon/);
  assert.match(navSource, /AppRouteGenerationIndicator/);
});

test("route session polling is gated behind authenticated client state", () => {
  assert.match(statusSource, /useAuthStore/);
  assert.match(statusSource, /authStore\.init/);
  assert.match(statusSource, /hasRouteGenerationStatusAccess/);
  assert.match(statusSource, /isUnauthorizedStatus/);
  assert.match(statusSource, /resetRouteGenerationStatusPolling/);
  assert.match(statusSource, /pollingSubscriberCount/);
  assert.match(statusSource, /status\s*===\s*401/);
});

test("route sessions can be deleted from saved generation history", () => {
  assert.match(deleteEndpointSource, /defineAuthenticatedHandler/);
  assert.match(deleteEndpointSource, /getRouterParam\(event, "session-id"\)/);
  assert.match(deleteEndpointSource, /deleteAiRouteSessionByIdForUser\(event\.context\.user\.id, sessionId\)/);
  assert.match(deleteEndpointSource, /setResponseStatus\(event, 204\)/);
  assert.match(querySource, /export async function deleteAiRouteSessionByIdForUser/);
  assert.match(querySource, /\.delete\(aiRouteSession\)/);
  assert.match(querySource, /eq\(aiRouteSession\.id, sessionId\)/);
  assert.match(querySource, /eq\(aiRouteSession\.userId, userId\)/);
  assert.match(statusSource, /deleteRouteGenerationSession/);
  assert.match(statusSource, /method: "DELETE"/);
  assert.match(statusSource, /csrf-token/);
  assert.match(statusSource, /sessions\.value\.filter\(session => session\.sessionId !== sessionId\)/);
  assert.match(historySource, /tabler:trash/);
  assert.match(historySource, /Delete \$\{getRouteSessionLabel\(routeSession\)\} from route history/);
});

test("Explore can restore a generation from a route session link", () => {
  assert.match(exploreSource, /route\.query\.sessionId/);
  assert.match(exploreSource, /restoreRouteSession\(readRouteSessionIdQuery/);
  assert.match(historySource, /Saved generations/);
  assert.match(historySource, /restoreRouteSession\(routeSession\.sessionId\)/);
});
