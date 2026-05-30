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

const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");

test("route session exposes optimistic point edit/delete/clear", () => {
  for (const fn of ["updateRoutePoint", "deleteRoutePoint", "clearActivePoints"]) {
    assert.match(sessionSource, new RegExp(`function ${fn}`));
    assert.match(sessionSource, new RegExp(`${fn},`)); // exported in the return object
  }
  // Optimistic mutation followed by revert-on-failure.
  assert.match(sessionSource, /const previous = pointsByVariantId\.value/);
  assert.match(sessionSource, /\[variantId\]: previous/); // rollback path
  assert.match(sessionSource, /method: "PATCH"/);
  assert.match(sessionSource, /method: "DELETE"/);
  assert.match(sessionSource, /points\/clear/);
});

const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");

test("mapbox composable supports marker dragging in edit mode", () => {
  assert.match(mapboxSource, /function enableMarkerDragging/);
  assert.match(mapboxSource, /function disableMarkerDragging/);
  assert.match(mapboxSource, /dragend/);
  assert.match(mapboxSource, /draggable/);
});

const editModeSource = await readFile("composables/use-route-edit-mode.ts", "utf8").catch(() => "");

test("route edit mode composable manages an isEditMode toggle", () => {
  assert.match(editModeSource, /export function useRouteEditMode/);
  assert.match(editModeSource, /isEditMode/);
  assert.match(editModeSource, /function toggleEditMode/);
  assert.match(editModeSource, /function setEditMode/);
});
