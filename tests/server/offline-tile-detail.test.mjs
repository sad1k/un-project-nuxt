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

test("offline region record persists the chosen detail level", async () => {
  const storeSource = await readFile("lib/offline/region-store.ts", "utf8");
  // Field on both the record and the input (schemaless — no DB version bump).
  const maxZoomFields = storeSource.match(/maxZoom\?: number;/g) ?? [];
  assert.equal(maxZoomFields.length, 2, "maxZoom on both OfflineRegion and OfflineRegionInput");
  assert.match(storeSource, /maxZoom: input\.maxZoom,/);
});

test("regions composable forwards maxZoom to the downloader", async () => {
  // downloadRegion already accepts minZoom/maxZoom — the composable just
  // never passed them.
  const composableSource = await readFile("composables/use-offline-regions.ts", "utf8");
  assert.match(composableSource, /async function download\(regionId: string, bbox: Bbox, maxZoom\?: number\)/);
  assert.match(composableSource, /regionId,[\t\v\f\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s*bbox,[\t\v\f\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*\n\s*maxZoom,/);
});

test("download sheet offers detail presets and threads the choice", async () => {
  const sheetSource = await readFile("components/offline/download-sheet.vue", "utf8");
  for (const label of ["\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F", "\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442", "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C"])
    assert.ok(sheetSource.includes(label), `${label} preset present`);
  assert.match(sheetSource, /maxZoom: 12/);
  assert.match(sheetSource, /maxZoom: 14/);
  assert.match(sheetSource, /maxZoom: 15/);
  // Size, quota and tile counts follow the selected preset\u2026
  assert.match(sheetSource, /estimateRegionSize\(props\.payload\.bbox, selectedMaxZoom\.value\)/);
  assert.match(sheetSource, /countTiles\(props\.payload\.bbox, 0, selectedMaxZoom\.value\)/);
  // \u2026and the choice reaches both the record and the downloader.
  assert.match(sheetSource, /maxZoom: selectedMaxZoom\.value/);
  assert.match(sheetSource, /download\(region\.id, payload\.bbox, selectedMaxZoom\.value\)/);
});

test("offline preview style declares the downloaded zoom range", async () => {
  // Source maxzoom must match what was downloaded: declare 14 while only
  // z0-12 exists and MapLibre shows blank past z12 instead of overzooming.
  const styleSource = await readFile("lib/offline/offline-style.ts", "utf8");
  assert.match(styleSource, /maxZoom = 14/);
  assert.match(styleSource, /maxzoom: maxZoom/);

  const previewSource = await readFile("components/offline/region-preview.vue", "utf8");
  assert.match(previewSource, /buildOfflineStyle\(region\.id, theme, region\.maxZoom \?\? 14\)/);
});
