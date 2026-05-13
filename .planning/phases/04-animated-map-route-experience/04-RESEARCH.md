# Phase 4: Animated Map Route Experience - Research

**Researched:** 2026-05-10
**Status:** Complete

## Scope

Phase 4 renders the Phase 3 route contract on the Explore map. The implementation must consume route points and route events that already include coordinates, day grouping, timing/duration, rationale, confidence, distance hints, and optional cost metadata. The user decisions in `04-CONTEXT.md` lock the map behavior: point-by-point SSE reveal, zoom-aware route line detail, segmented day selection with isolated route sections, generated-route markers as the default route view, distinct current/user-owned markers when shown, and distance labels on the map plus sidebar per-leg and summary distances.

## Official Mapbox Findings

- Mapbox GL JS route lines should be represented as GeoJSON sources and line layers. The official GeoJSON line examples use `map.addSource(...)` and `map.addLayer(...)`, which matches the current `use-mapbox.ts` route source pattern and can be upgraded instead of replaced.
- For progressive route animation, the official line animation pattern updates a GeoJSON source over time and drives changes with `requestAnimationFrame`. Phase 4 should use this idea carefully: append route coordinates as route points arrive, but avoid continuously animating all geometry when a source update is enough.
- Custom HTML markers are officially supported through `new mapboxgl.Marker({ element })`. The existing `route-marker.ts` marker creation is therefore a reasonable local pattern for numbered route stops and distinct current-location/user-owned markers.
- Mapbox map state exposes zoom and movement events through the `Map` API. Phase 4 can use `getZoom()` plus `zoomend` or `moveend` listeners to switch between overview mode and detailed route line/leg-label mode.
- Leg labels should be map layers, not many floating HTML elements. A GeoJSON source containing midpoint features plus a `symbol` layer with `text-field` labels is the cleanest direction because it can be filtered/updated with the selected route section.

## Local Code Findings

### Current Route Map Flow

- `pages/explore.vue` already watches `useAiRouteSession().activePoints` and maps Phase 3 route points into the older `RoutePoint` shape expected by `use-mapbox.ts`.
- The current watcher redraws all markers, the route line, and bounds whenever `mapRoutePoints` changes. This is enough for a prototype, but Phase 4 needs a more deliberate route display model so progressive SSE updates do not repeatedly reset the whole map.
- `composables/use-mapbox.ts` already owns marker cleanup, line source/layer creation, and `fitToRoute`. It also owns module-level shared state, timers, and animation frames, so execution must preserve cleanup paths.
- `components/explore/route-marker.ts` currently imports the old mocked route-generator type. Phase 4 should retarget marker data to a shared Explore route-map model or the Phase 3 `RoutePoint` contract.
- `components/explore/route-panel.vue` already has the right home for route stats, route point list, route history, and follow-up input. It should also own the segmented day selector and sidebar distance summary.

### Route Data Contract

- `lib/ai/route-contract.ts` already exposes coordinates, `day`, optional `estimatedDurationMinutes`, `rationale`, `confidence`, `approximateDistanceMeters`, and optional cost metadata.
- `use-ai-route-session.ts` sorts route points only by day. Phase 4 should preserve point order within each day by sequence or stream order when building route legs. If Phase 3 does not expose enough ordering metadata, the Phase 4 helper should use active array order after day grouping and leave a note for future route contract hardening.
- `lib/db/queries/ai-route.ts` orders persisted points by day and sequence, so route display should avoid throwing away that order once hydrated or streamed.

## Recommended Implementation Shape

1. Add a small pure route-map helper module under `lib/explore/route-map.ts`.
   - Convert Phase 3 `RoutePoint[]` into map-ready route stops, route legs, day groups, selected-day point slices, leg label features, and distance summaries.
   - Format distances consistently, returning empty/unknown states when distance metadata is missing.
   - Distinguish marker kinds: `generated`, `current-location`, and `user-place`.

2. Evolve `use-mapbox.ts` from full redraw into explicit route rendering methods.
   - Keep marker creation for generated route stops, but sync by route point id where feasible.
   - Use a route line GeoJSON source/layer for all or selected points.
   - Use a separate leg-label GeoJSON source plus symbol layer for on-map distance labels.
   - Use zoom state to show detailed line/label behavior only when it helps the user see route sections.

3. Update Explore page and route panel together.
   - Track selected day in Explore route state.
   - Add a segmented day selector.
   - Filter map and sidebar route rows to the selected day section.
   - Show per-leg and total distance summary in the sidebar.
   - Keep saved places in context selection, not mixed into the route map by default.

4. Add focused tests before relying on visual/manual checks.
   - `tests/server/explore-route-map.test.mjs` can source-check or import pure helpers depending on build constraints.
   - Tests should cover day grouping, selected-day filtering, distance summary, no-distance fallback, and marker kind distinction.
   - Manual browser verification remains necessary for Mapbox rendering, zoom-aware label visibility, and animation feel.

## Risks and Mitigations

- **Mapbox singleton fragility:** `use-mapbox.ts` has module-level state. Keep cleanup explicit and avoid introducing another map singleton. Verify unmount cleanup still removes layers, markers, timers, and animation frames.
- **Repeated redraw jank:** Current `watch(mapRoutePoints)` redraws every route update. Use a display model and idempotent source/layer updates so SSE point arrivals do not constantly reset the camera.
- **Missing distance data:** Phase 3 distance is optional. UI must hide or mark unavailable distances instead of inventing values.
- **Route order ambiguity:** If streamed points arrive out of sequence, day-only sorting is insufficient. Prefer persisted sequence when available; otherwise keep stable stream order within a day.
- **Saved-place confusion:** MAP-06 is satisfied by explicit context-picking and distinct current/user point styling, not by dumping all saved places onto the route map.
- **Visual regressions:** Automated tests can cover transforms, but map labels, selected-day isolation, and zoom behavior need browser verification.

## Sources

- Mapbox GL JS animate a line example: https://docs.mapbox.com/mapbox-gl-js/example/animate-a-line/
- Mapbox GL JS GeoJSON line example: https://docs.mapbox.com/mapbox-gl-js/example/geojson-line/
- Mapbox GL JS custom markers examples: https://docs.mapbox.com/mapbox-gl-js/example/custom-marker-icons/
- Mapbox GL JS Map API: https://docs.mapbox.com/mapbox-gl-js/api/map/
- Mapbox Style Specification layers reference: https://docs.mapbox.com/style-spec/reference/layers/

## Research Complete

Planner should create a small model/helper plan first, then split map-rendering and sidebar/day-control work into dependent implementation plans with a final visual verification checkpoint.

