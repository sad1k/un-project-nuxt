/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const previewSource = await readFile("components/offline/region-preview.vue", "utf8");

test("offline preview map container sizes itself explicitly", () => {
  // maplibre-gl.css declares `.maplibregl-map { position: relative }` and is
  // dynamically imported AFTER Tailwind, so it silently overrides the
  // container's `absolute` class. With position:relative, `inset-0` stops
  // sizing the element and its height collapses to 0 — the preview renders
  // a blank gray rectangle. The container must use explicit h-full/w-full
  // (same pattern as the explore Mapbox map), never absolute+inset.
  const containerMatch = previewSource.match(/ref="mapContainer"\s+class="([^"]+)"/);
  assert.ok(containerMatch, "map container with ref=\"mapContainer\" not found");

  const classes = containerMatch[1].split(/\s+/);
  assert.ok(classes.includes("h-full"), "map container must have h-full");
  assert.ok(classes.includes("w-full"), "map container must have w-full");
  assert.ok(
    !classes.includes("absolute"),
    "absolute is overridden by .maplibregl-map { position: relative } from maplibre-gl.css — size explicitly instead",
  );
});
