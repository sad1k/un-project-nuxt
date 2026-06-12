/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("size estimator is parameterized by max zoom", async () => {
  // The download sheet recomputes the size per detail preset, so the
  // estimator can't hardcode the z0-14 range anymore.
  const source = await readFile("lib/offline/size-estimator.ts", "utf8");
  assert.match(source, /export function estimateRegionSize\(bbox: Bbox, maxZoom = MAX_ZOOM\)/);
  assert.match(source, /z <= maxZoom/);
});
