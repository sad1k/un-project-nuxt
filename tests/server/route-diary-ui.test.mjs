/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionsEndpointSource = await readFile("server/api/ai/route-sessions.get.ts", "utf8");
const restoreEndpointSource = await readFile("server/api/ai/route/[session-id].get.ts", "utf8");
const aiRouteSessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");
const statusSource = await readFile("composables/use-route-generation-status.ts", "utf8");
const historySource = await readFile("components/explore/route-history.vue", "utf8");
const panelSource = await readFile("components/explore/route-panel.vue", "utf8");

test("route session APIs expose user-scoped diary save summaries", () => {
  assert.match(sessionsEndpointSource, /findRouteDiarySaveSummariesByVariantIds/);
  assert.match(sessionsEndpointSource, /event\.context\.user\.id/);
  assert.match(sessionsEndpointSource, /diarySave/);
  assert.match(sessionsEndpointSource, /expectedPointCounts/);

  assert.match(restoreEndpointSource, /findRouteDiarySaveSummariesByVariantIds/);
  assert.match(restoreEndpointSource, /event\.context\.user\.id/);
  assert.match(restoreEndpointSource, /diarySave/);
  assert.match(restoreEndpointSource, /variant\.points\.length/);
});

test("client route state carries diary save summaries after restore and status polling", () => {
  assert.match(aiRouteSessionSource, /type RouteDiarySaveSummary/);
  assert.match(aiRouteSessionSource, /diarySave\?: RouteDiarySaveSummary/);
  assert.match(aiRouteSessionSource, /saveRoutePointToDiary/);
  assert.match(aiRouteSessionSource, /\/api\/ai\/route\/\$\{sessionId\.value\}\/diary/);
  assert.match(aiRouteSessionSource, /refreshCurrentRouteSessionSnapshot/);
  assert.match(statusSource, /diarySave: RouteDiarySaveSummary \| null/);
});

test("Explore history and route panel display explicit diary save status", () => {
  assert.match(historySource, /getDiarySaveLabel/);
  assert.match(historySource, /Diary saved/);
  assert.match(historySource, /No route stops saved/);
  assert.match(historySource, /routeSession\.diarySave/);

  assert.match(panelSource, /activeVariantDiarySave/);
  assert.match(panelSource, /diarySaveLabel/);
  assert.match(panelSource, /Saved to diary/);
  assert.match(panelSource, /Save route stops from the map/);
});
