/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaSource = await readFile("lib/db/schema/route-diary-save.ts", "utf8");
const schemaIndexSource = await readFile("lib/db/schema/index.ts", "utf8");
const querySource = await readFile("lib/db/queries/route-diary-save.ts", "utf8");
const locationQuerySource = await readFile("lib/db/queries/location.ts", "utf8");
const runnerSource = await readFile("lib/ai/route-generation-runner.ts", "utf8");
const saveEndpointSource = await readFile("server/api/ai/route/[session-id]/diary.post.ts", "utf8");

test("route diary save schema links AI route points to diary logs idempotently", () => {
  assert.match(schemaSource, /export const routeDiarySave/);

  for (const column of [
    "userId",
    "sessionId",
    "variantId",
    "routePointId",
    "locationId",
    "locationLogId",
    "status",
    "failureCode",
  ]) {
    assert.match(schemaSource, new RegExp(column));
  }

  assert.match(schemaSource, /aiRouteSession/);
  assert.match(schemaSource, /aiRouteVariant/);
  assert.match(schemaSource, /locationLog/);
  assert.match(schemaSource, /unique\(\)\.on\(t\.userId,\s*t\.sessionId,\s*t\.variantId,\s*t\.routePointId\)/);
  assert.match(schemaIndexSource, /route-diary-save/);
});

test("route diary save query is user-scoped, creates diary logs, and reports summary state", () => {
  assert.match(querySource, /export async function saveRoutePointToDiary/);
  assert.match(querySource, /export async function saveCompletedRouteToDiary/);
  assert.match(querySource, /export async function findRouteDiarySaveSummariesByVariantIds/);
  assert.match(querySource, /insertLocationLog/);
  assert.match(querySource, /findOrCreateLocationForRoutePoint/);
  assert.match(querySource, /routeDiarySave/);
  assert.match(querySource, /eq\(aiRouteVariant\.userId,\s*userId\)/);
  assert.match(querySource, /eq\(routeDiarySave\.userId,\s*userId\)/);
  assert.match(querySource, /status:\s*"saved"/);
  assert.match(querySource, /status:\s*"failed"/);
});

test("route diary save endpoint persists one explicit route point", () => {
  assert.match(saveEndpointSource, /SaveRoutePointToDiaryBodySchema/);
  assert.match(saveEndpointSource, /routePointId/);
  assert.match(saveEndpointSource, /variantId/);
  assert.match(saveEndpointSource, /event\.context\.user\.id/);
  assert.match(saveEndpointSource, /saveRoutePointToDiary/);
});

test("location helper reuses the user-owned place before creating a generated route point place", () => {
  assert.match(locationQuerySource, /export async function findOrCreateLocationForRoutePoint/);
  assert.match(locationQuerySource, /findLocationByName/);
  assert.match(locationQuerySource, /customAlphabet/);
  assert.match(locationQuerySource, /slugify/);
  assert.match(locationQuerySource, /insertLocation/);
});

test("route generation completion waits for explicit diary saves", () => {
  assert.doesNotMatch(runnerSource, /saveCompletedRouteToDiary/);

  const completionIndex = runnerSource.indexOf("await markAiRouteVariantCompleted");

  assert.ok(completionIndex >= 0, "runner should mark the route variant completed");
  assert.doesNotMatch(runnerSource, /requestContextJson/);
  assert.doesNotMatch(runnerSource, /payloadJson/);
  assert.doesNotMatch(runnerSource, /providerBodyPreview/);
  assert.doesNotMatch(runnerSource, /Authorization/);
});
