/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const popupSource = await readFile("components/explore/place-popup.ts", "utf8").catch(() => "");
const markerSource = await readFile("components/explore/route-marker.ts", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const pageSource = await readFile("pages/explore.vue", "utf8");
const cssSource = await readFile("assets/css/main.css", "utf8");
const composableSource = await readFile("composables/use-place-intelligence.ts", "utf8").catch(() => "");
const createPopupSource = popupSource.slice(
  popupSource.indexOf("export function createPlacePopupHTML"),
  popupSource.indexOf("export function createPlacePopupLoadingHTML"),
);

test("popup renderer is a pure photo-first HTML renderer", () => {
  assert.match(popupSource, /export function createPlacePopupHTML/);
  assert.match(popupSource, /export function escapeHtml/);
  assert.match(popupSource, /class="place-popup__photo"/);
  assert.match(popupSource, /class="place-popup__body"/);
  assert.ok(
    createPopupSource.indexOf("renderPhotoSection") < createPopupSource.indexOf("place-popup__body"),
    "photo markup should appear before body markup",
  );
  assert.doesNotMatch(popupSource, /\bdocument\./);
  assert.doesNotMatch(popupSource, /\bwindow\./);
});

test("popup renderer escapes provider route app and AI strings", () => {
  assert.match(popupSource, /replace\(/);
  assert.match(popupSource, /&amp;/);
  assert.match(popupSource, /&lt;/);
  assert.match(popupSource, /&quot;/);
  assert.match(popupSource, /escapeHtml\(place\.name\)/);
  assert.match(popupSource, /escapeHtml\(place\.routeRationale/);
  assert.match(popupSource, /escapeHtml\(place\.aiSummary\.text\)/);
});

test("popup renderer shows missing data placeholders instead of silent gaps", () => {
  for (const slot of ["photo", "reviews", "rating", "cost", "community"]) {
    assert.match(popupSource, new RegExp(`missing.*${slot}|${slot}.*missing`, "is"));
  }
  assert.match(popupSource, /renderMissingSlots/);
  assert.match(popupSource, /missingSlots/);
});

test("popup renderer labels sourced rating reviews cost and community uncertainty", () => {
  assert.match(popupSource, /reviewCount/);
  assert.match(popupSource, /reviews/);
  assert.match(popupSource, /cost/);
  assert.match(popupSource, /likelyCurrentlyThere/);
  assert.match(popupSource, /confidence/);
  assert.match(popupSource, /source\.label/);
  assert.doesNotMatch(popupSource, /JSON\.stringify/);
});

test("route popup constrains tall and narrow content inside the viewport", () => {
  assert.match(popupSource, /width:min\(280px,calc\(100vw - 48px\)\)/);
  assert.match(popupSource, /max-height:max\(300px,min\(440px,calc\(100svh - 176px\)\)\)/);
  assert.match(popupSource, /overflow-y:auto/);
  assert.match(popupSource, /overscroll-behavior:contain/);
  assert.match(popupSource, /flex-wrap:wrap/);
  assert.match(popupSource, /position:sticky;bottom:0/);
  assert.match(mapboxSource, /className:\s*"explore-route-popup"/);
  assert.match(mapboxSource, /maxWidth:\s*"min\(300px, calc\(100vw - 32px\)\)"/);
  assert.match(cssSource, /\.explore-route-popup/);
  assert.match(cssSource, /max-width:\s*calc\(100vw - 32px\)\s*!important/);
  assert.match(cssSource, /padding:\s*0/);
});

test("client composable fetches and caches generated route point intelligence without provider secrets", () => {
  assert.match(composableSource, /usePlaceIntelligence/);
  assert.match(composableSource, /\/api\/explore\/place-intelligence/);
  assert.match(composableSource, /variantId/);
  assert.match(composableSource, /routePointId/);
  assert.match(composableSource, /cacheKey/);
  assert.match(composableSource, /markerKind !== "generated"/);
  assert.doesNotMatch(composableSource, /GOOGLE_PLACES_API_KEY|places\.googleapis\.com|OPENAI_API_KEY/);
});

test("Mapbox route markers can resolve rich async popup HTML and keep a fallback", () => {
  assert.match(markerSource, /createPopupHTML/);
  assert.match(markerSource, /escapeHtml/);
  assert.match(markerSource, /document\.createElement\("div"\)/);
  assert.match(markerSource, /appendChild\(marker\)/);
  assert.match(markerSource, /markerDrop/);
  assert.match(markerSource, /marker\.textContent/);
  assert.match(mapboxSource, /getPopupHTML/);
  assert.match(mapboxSource, /setHTML/);
  assert.match(mapboxSource, /mouseenter/);
  assert.match(mapboxSource, /click/);
  assert.match(pageSource, /usePlaceIntelligence/);
  assert.match(pageSource, /createPlacePopupHTML/);
});
