/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const popupSource = await readFile("components/explore/place-popup.ts", "utf8").catch(() => "");
const markerSource = await readFile("components/explore/route-marker.ts", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const pageSource = await readFile("pages/explore.vue", "utf8");
const cssSource = await readFile("assets/css/main.css", "utf8");
const modelSource = await readFile("lib/explore/place-intelligence.ts", "utf8");
const providerSource = await readFile("lib/explore/place-intelligence-providers.ts", "utf8");
const composableSource = await readFile("composables/use-place-intelligence.ts", "utf8").catch(() => "");
const sidePanelSource = await readFile("components/explore/place-side-panel.vue", "utf8").catch(() => "");
const placeDetailSource = await readFile("components/explore/place-detail.vue", "utf8").catch(() => "");
const sheetSource = await readFile("components/explore/place-bottom-sheet.vue", "utf8").catch(() => "");
const createPopupSource = popupSource.slice(
  popupSource.indexOf("export function createPlacePopupHTML"),
  popupSource.indexOf("export function createPlacePopupLoadingHTML"),
);
const normalizePhotoSource = providerSource.slice(
  providerSource.indexOf("function normalizePhoto"),
  providerSource.indexOf("function normalizeRating"),
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

test("place photos are real provider or app media, never AI illustrations", () => {
  assert.match(modelSource, /PlacePhotoSourceSchema/);
  assert.match(modelSource, /provider/);
  assert.match(modelSource, /app/);
  assert.match(modelSource, /Place photos must come from real provider or app-owned media/);
  assert.doesNotMatch(normalizePhotoSource, /kind:\s*"ai"/);
  assert.doesNotMatch(normalizePhotoSource, /kind:\s*"missing"/);
  assert.doesNotMatch(popupSource, /illustrative|AI-generated|generated placeholder/i);
});

test("popup photo section renders real source or attribution and explicit missing state", () => {
  assert.match(popupSource, /const caption = place\.photo\.attribution \|\| place\.photo\.source\.label/);
  assert.match(popupSource, /<figcaption/);
  assert.match(popupSource, /place-popup__photo--missing/);
  assert.match(popupSource, /photoMissing\?\.label/);
  assert.doesNotMatch(popupSource, /AI-generated place photo|illustrative place photo/i);
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
  assert.match(cssSource, /width:\s*min\(280px,\s*calc\(100vw - 48px\)\)/);
  assert.match(cssSource, /max-height:\s*max\(300px,\s*min\(440px,\s*calc\(100svh - 176px\)\)\)/);
  assert.match(cssSource, /overflow-y:\s*auto/);
  assert.match(cssSource, /overscroll-behavior:\s*contain/);
  assert.match(popupSource, /flex-wrap:wrap/);
  assert.match(popupSource, /position:sticky;bottom:0/);
  assert.match(popupSource, /data-place-save-cta/);
  assert.match(popupSource, /data-place-directions-cta/);
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
  assert.match(mapboxSource, /activeRoutePopup/);
  assert.match(mapboxSource, /scheduleRoutePopupClose/);
  assert.match(mapboxSource, /1000/);
  assert.match(pageSource, /usePlaceIntelligence/);
  assert.match(pageSource, /createPlacePopupHTML/);
});

test("place card loads progressively: instant skeletons, parallel detail + photo, streaming repaint", () => {
  // Renderer: per-section loading flags drive shimmer skeletons.
  assert.match(popupSource, /place-popup__skel/);
  assert.match(popupSource, /renderDetailsSkeleton/);
  assert.match(popupSource, /loading\.photo === true/);
  assert.match(popupSource, /loading\.details === true/);
  // Popup gains a render(html) sink it can call repeatedly, guarded against stale repaints.
  assert.match(mapboxSource, /renderPopup/);
  assert.match(mapboxSource, /activeRoutePopup !== popup/);
  // Composable splits the slow photo onto its own request and runs both in parallel.
  assert.match(composableSource, /loadForRoutePointProgressive/);
  assert.match(composableSource, /withPhoto: 0/);
  assert.match(composableSource, /\/api\/explore\/place-photo-resolve/);
  assert.match(composableSource, /Promise\.all/);
  // Page wires the progressive renderer into the map markers.
  assert.match(pageSource, /renderPopup/);
  assert.match(pageSource, /loadForRoutePointProgressive/);
  // Shimmer keyframes exist and respect reduced-motion.
  assert.match(cssSource, /place-popup__skel/);
  assert.match(cssSource, /placePopupShimmer/);
  assert.match(cssSource, /prefers-reduced-motion/);
});

test("place photos prefetch as route points stream in to hide the slowest request", () => {
  // Composable exposes a deduped, throttled background photo warmer.
  assert.match(composableSource, /prefetchPhotoForRoutePoint/);
  assert.match(composableSource, /resolvePlacePhoto/);
  assert.match(composableSource, /photoResolutionCache/);
  assert.match(composableSource, /PHOTO_PREFETCH_CONCURRENCY/);
  // Only generated stops are warmed, and prefetching stays client-only.
  assert.match(composableSource, /markerKind !== "generated"/);
  assert.match(composableSource, /import\.meta\.client/);
  // The progressive popup loader reuses the same resolver, so an opened card joins the in-flight
  // prefetch instead of re-running the provider chain.
  assert.match(composableSource, /resolvePlacePhoto\(point\)/);
  // The page warms photos for every generated stop as the route streams in / is restored.
  assert.match(pageSource, /prefetchPhotoForRoutePoint/);
});

test("shared place detail (carousel + tabs + reviews) powers BOTH the desktop panel and the mobile sheet", () => {
  // Shared rich content: carousel over the provider gallery + tabs (Обзор / Фото / Отзывы) + reviews.
  assert.match(placeDetailSource, /carouselIndex/);
  assert.match(placeDetailSource, /photo\.gallery/);
  assert.match(placeDetailSource, /activeTab/);
  assert.match(placeDetailSource, /Обзор/);
  assert.match(placeDetailSource, /Фото/);
  assert.match(placeDetailSource, /Отзывы/);
  assert.match(placeDetailSource, /v-for="\(review, index\) in reviews"/);
  assert.match(placeDetailSource, /Отзывов из источников пока нет/);
  // Photo and details stream in independently; skeletons respect reduced motion.
  assert.match(placeDetailSource, /photoLoading/);
  assert.match(placeDetailSource, /detailsLoading/);
  assert.match(placeDetailSource, /place-detail__skel/);
  assert.match(placeDetailSource, /prefers-reduced-motion/);
  // Both cards render the same component, so the carousel works on mobile too (adaptive version).
  assert.match(sidePanelSource, /ExplorePlaceDetail/);
  assert.match(sheetSource, /ExplorePlaceDetail/);
  // Desktop panel wrapper: desktop-only, slides in from the left, Esc-to-close.
  assert.match(sidePanelSource, /md:flex/);
  assert.match(sidePanelSource, /translateX\(-100%\)/);
  assert.match(sidePanelSource, /Escape/);
  // Wired into the page beside the bottom sheet on the same selected-place state.
  assert.match(pageSource, /ExplorePlaceSidePanel/);
  assert.match(pageSource, /:intelligence="selectedSheetIntelligence"/);
  // The gallery comes free from TripAdvisor's single multi-photo call (up to 5) — no extra quota.
  assert.match(providerSource, /gallery: string\[\]/);
  assert.match(providerSource, /gallery\.length >= 5/);
});
