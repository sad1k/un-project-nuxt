/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const listEndpointSource = await readFile("server/api/admin/route-generations.get.ts", "utf8");
const detailEndpointSource = await readFile("server/api/admin/route-generations/[session-id].get.ts", "utf8");
const userRestoreEndpointSource = await readFile("server/api/ai/route/[session-id].get.ts", "utf8");
const querySource = await readFile("lib/db/queries/ai-route.ts", "utf8");
const schemaSource = await readFile("lib/db/schema/ai-route.ts", "utf8");
const runnerSource = await readFile("lib/ai/route-generation-runner.ts", "utf8");

test("admin route-generation endpoints are role-gated and expose list/detail surfaces", () => {
  assert.match(listEndpointSource, /defineAdminHandler/);
  assert.match(listEndpointSource, /findAdminAiRouteSessionSummaries/);
  assert.match(listEndpointSource, /failureStage/);
  assert.match(listEndpointSource, /failureCode/);
  assert.match(listEndpointSource, /parseLimit/);
  assert.match(listEndpointSource, /generatedAt/);

  assert.match(detailEndpointSource, /defineAdminHandler/);
  assert.match(detailEndpointSource, /getRouterParam\(event, "session-id"\)/);
  assert.match(detailEndpointSource, /findAdminAiRouteSessionDetail/);
  assert.match(detailEndpointSource, /statusCode:\s*404/);
});

test("admin diagnostics use hybrid failure taxonomy and safe explanations", () => {
  assert.match(schemaSource, /failureStage:\s*text\(\{\s*enum:\s*\["validation",\s*"provider",\s*"parsing",\s*"persistence",\s*"diary_save",\s*"notification",\s*"unknown"\]/);
  assert.match(querySource, /export type AiRouteFailureStage/);
  assert.match(querySource, /export function resolveAiRouteFailureStage/);
  assert.match(querySource, /createAdminFailureDiagnostics/);
  assert.match(querySource, /getAdminFailureRetryability/);
  assert.match(querySource, /safeExplanation/);
  assert.match(runnerSource, /resolveAiRouteFailureStage\(code\)/);
  assert.match(runnerSource, /failureStage/);
});

test("admin queries return sanitized route snapshots without raw provider payloads", () => {
  assert.match(querySource, /createSanitizedRequestSummary/);
  assert.match(querySource, /candidatePlaceCount/);
  assert.match(querySource, /savedPlaceCount/);
  assert.match(querySource, /diaryLogCount/);
  assert.match(querySource, /events:\s*session\.events\.map/);
  assert.match(querySource, /points:\s*variant\.points\.map/);
  assert.match(querySource, /priceSource/);
  assert.doesNotMatch(listEndpointSource, /requestContextJson|payloadJson|Authorization|providerBodyPreview/);
  assert.doesNotMatch(detailEndpointSource, /requestContextJson|payloadJson|Authorization|providerBodyPreview/);
});

test("regular route session restore stays user-scoped while carrying failure stage metadata", () => {
  assert.match(userRestoreEndpointSource, /defineAuthenticatedHandler/);
  assert.match(userRestoreEndpointSource, /findAiRouteSessionByIdForUser\(event\.context\.user\.id, sessionId\)/);
  assert.match(userRestoreEndpointSource, /failureCode/);
  assert.match(userRestoreEndpointSource, /failureStage/);
  assert.doesNotMatch(userRestoreEndpointSource, /findAdminAiRouteSessionDetail/);
});
