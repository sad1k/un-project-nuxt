/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const contractSource = await readFile("lib/ai/route-contract.ts", "utf8");

test("route contract exposes a point patch schema for edits", () => {
  assert.match(contractSource, /export const RoutePointPatchSchema/);
  assert.match(contractSource, /export type RoutePointPatch/);
  // Reuses the existing coordinate schema and requires at least one field.
  assert.match(contractSource, /coordinates: ExploreCoordinatesSchema\.optional\(\)/);
  assert.match(contractSource, /at least one field|Не передано ни одного поля|hasAtLeastOneField/);
});

const queriesSource = await readFile("lib/db/queries/ai-route.ts", "utf8");

test("ai-route queries support per-point update, delete and clear", () => {
  assert.match(queriesSource, /export async function updateAiRoutePoint/);
  assert.match(queriesSource, /export async function deleteAiRoutePoint/);
  assert.match(queriesSource, /export async function clearAiRouteVariantPoints/);
  // Ownership filter on every mutation.
  assert.match(queriesSource, /eq\(aiRoutePoint\.userId, userId\)/);
  assert.match(queriesSource, /eq\(aiRoutePoint\.routePointId, input\.routePointId\)/);
  // Deleting a point also cleans up its place story rows.
  assert.match(queriesSource, /\.delete\(routePlaceStory\)/);
});

const patchEndpoint = await readFile("server/api/ai/route/[session-id]/point/[point-id].patch.ts", "utf8").catch(() => "");
const deleteEndpoint = await readFile("server/api/ai/route/[session-id]/point/[point-id].delete.ts", "utf8").catch(() => "");
const clearEndpoint = await readFile("server/api/ai/route/[session-id]/points/clear.post.ts", "utf8").catch(() => "");

test("point endpoints are authenticated and validated", () => {
  for (const src of [patchEndpoint, deleteEndpoint, clearEndpoint]) {
    assert.match(src, /defineAuthenticatedHandler/);
    assert.match(src, /event\.context\.user\.id/);
  }
  assert.match(patchEndpoint, /RoutePointPatchSchema/);
  assert.match(patchEndpoint, /updateAiRoutePoint/);
  assert.match(patchEndpoint, /statusCode: 404/);
  assert.match(deleteEndpoint, /deleteAiRoutePoint/);
  assert.match(clearEndpoint, /clearAiRouteVariantPoints/);
});
