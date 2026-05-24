# Explore Mobile Bugfixes — Design

Date: 2026-05-24
Branch: `fix/explore-mobile-bugs`

## Goal

Fix five UX/visual bugs on the `/explore` page, focused on mobile usability and globe interaction.

## Bug inventory

### 1. Remove user-generated photo dots from explore
Public-photo markers belong on the social feed, not on the route-planning surface. They clutter the globe and the cards (e.g. the "Ягодная улица" certificate) appear where route markers should be dominant.

**Change:** Remove `<ExplorePlacePhotoPublicPhotoLayer>` mount, the `showPublicPhotos` state, and its toggle button from `pages/explore.vue`. The component itself stays in the codebase for other surfaces.

### 2. Mobile route-marker cards too large
Currently a Mapbox `Popup` is attached above each marker. On mobile the popup is wider than the viewport and obscures the map.

**Change:** Yandex-style bottom sheet on touch devices:
- Add an `onMarkerClick(point)` callback option to `useMapbox.addMarkers`.
- On touch devices, suppress the floating popup (don't bind hover, don't `addTo(map)` on click), instead invoke `onMarkerClick`.
- In `pages/explore.vue`, hold `selectedPlace` ref and pass to existing `components/explore/place-bottom-sheet.vue` (already implemented but unused).
- Desktop hover/click popup preserved unchanged.

Touch-device detection: `window.matchMedia('(hover: none) and (pointer: coarse)').matches`, evaluated lazily.

### 3. Globe rotates while route is active
`startGlobeSpin` resumes whenever `idle` fires with `zoom<4 && spinning`. After zooming out from a generated route, the globe starts spinning again over the active markers.

**Change:** Introduce module-level `hasActiveRoute` boolean.
- `addMarkers(points, …)` with non-empty `points` → `hasActiveRoute = true`, `spinning = false`, cancel rAF.
- `clearMarkers()` → `hasActiveRoute = false`, `spinning = true` (re-armed for idle handler).
- `idle` handler gates on `!hasActiveRoute`.

### 4. Weather popover overflows on mobile
`max-md:fixed right-3 top-[120px] max-w-80` puts the panel at the upper-right corner but the trigger button is also there; the panel collides with header and is clipped.

**Change:** On mobile, all four popovers in `components/explore/results-actions.vue` (weather/history/followUp/share) become bottom sheets:
- Classes: `max-md:fixed max-md:inset-x-3 max-md:bottom-[88px] max-md:top-auto max-md:right-auto max-md:w-auto max-md:max-w-none max-md:max-h-[60vh] max-md:overflow-y-auto`.
- Add a small header row with title + close (×) button inside each popover on mobile only.
- Backdrop tap to close already works via existing `document` listener.

### 5. History selection doesn't fly globe to new route
The existing watcher in `pages/explore.vue` calls `fitToRoute` only when `lastFittedScope` differs; this can be stale when only the variant ID changes but points arrive on the same tick.

**Change:** Dedicated watcher on `activeVariantId`:
- On change, `await nextTick()`, read `selectedRoutePoints.value` (or full `routeMapPoints.value` if no day filter), call `mapbox.fitToRoute(points)` unconditionally.
- Reset `lastFittedScope` so the existing watcher does not double-fit.

## Architecture notes

- `place-bottom-sheet.vue` already renders the same HTML produced by `createPlacePopupHTML`, with `data-place-*-cta` handlers. The wiring just needs the parent to provide `place`, `intelligence`, `loading`, and the three callbacks (save/directions/story) — same handlers `pages/explore.vue` already passes to `addMarkers`.
- `useMapbox` keeps state at module scope; touch-device branching lives inside `addMarkers` so callers don't need to know.
- No changes to `useAiRouteSession`, `useExploreContext`, server endpoints, or data shapes.

## Out of scope

- Replacing public photo dots elsewhere (feed surface untouched).
- Refactoring `useMapbox` toward a reactive options object.
- Reworking the wizard, route-day selector, story card, weather-tips component internals.
- Tests — manual verification only (no test infra for this surface).

## Verification

Manual, in browser devtools mobile emulation (iPhone 13 viewport):
1. Load `/explore` → no red user dots on globe.
2. Generate a route → tap any marker → bottom sheet slides up with full place info, drag-to-dismiss works.
3. Zoom out the globe with an active route → no auto-rotation.
4. Tap weather/history/follow-up/share buttons → each opens a bottom sheet, fits viewport, has visible close button.
5. Open history → tap a different variant → globe smoothly flies to the new route's bounds.

Desktop sanity check: hover popups still work, no visual regressions.
