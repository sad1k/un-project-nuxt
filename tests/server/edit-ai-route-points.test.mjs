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
