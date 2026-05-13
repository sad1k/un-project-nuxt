# Phase 4: Animated Map Route Experience - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 turns Phase 3 structured AI route output into the visible Explore map route experience. It renders generated route markers, progressive route lines, day-by-day route sections, animated map transitions, distance labels, and route sidebar summaries. It consumes AI route sessions, variants, route points, and SSE events from Phase 3, but does not own rich provider-backed place intelligence, weather tips, or save-to-diary persistence.

</domain>

<decisions>
## Implementation Decisions

### Progressive Route Reveal

- **D-01:** Generated route markers should appear point-by-point as SSE route events arrive, not wait until the entire route variant is complete.
- **D-02:** Route line reveal is useful when the user is zoomed close enough to actually see route detail. At far zoom levels, the map may use a calmer overview or delay detailed line animation until zoom/focus makes the line meaningful.
- **D-03:** The progressive reveal should stay map-first and should never expose raw route JSON or implementation events to the user.

### Day-by-Day Route Control

- **D-04:** Day grouping should use a segmented selector.
- **D-05:** Selecting a day should isolate that day or section of the route from the full route, so the user can focus on one route segment at a time.
- **D-06:** The selected day interaction should update both the map and route sidebar consistently.

### Generated Route Points and User-Owned Points

- **D-07:** During route viewing, the map should primarily show generated route points, not mix generated route markers with all saved places.
- **D-08:** Saved/user places should appear while picking route settings/context, where the user explicitly selects places to include in the AI request.
- **D-09:** If the user's current location or another user-owned point is shown on the route map, it must look visually distinct from generated AI route points.

### Distance and Leg Details

- **D-10:** Distance should appear as on-map leg labels where route leg data is available.
- **D-11:** The sidebar should show per-leg distance details and a route summary.
- **D-12:** Distance UI should use available Phase 3 distance metadata and degrade gracefully when estimates are missing or incomplete.

### the agent's Discretion

- The agent/planner may choose the exact animation timing, easing, zoom threshold, map layer implementation, and marker/line styling as long as the route appears point-by-point, detailed line reveal is tied to useful zoom/focus, and day selection isolates a route section.
- The agent/planner may choose whether non-selected route days are hidden entirely or represented only through a subdued overview outside the active selection, as long as the selected-day experience clearly isolates the route section.
- The agent/planner may choose the exact sidebar layout for route summary and leg details, as long as per-leg and total summary distances are visible when data exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, and map-first route-planning value.
- `.planning/REQUIREMENTS.md` - Requirement IDs MAP-01 through MAP-06 and v1/v2 scope boundaries.
- `.planning/ROADMAP.md` - Phase 4 goal and success criteria.
- `.planning/STATE.md` - Current workflow state and resume information.
- `.planning/phases/01-explore-scope-and-verification-foundation/01-CONTEXT.md` - Locked Explore flow and original map/route feature decisions.
- `.planning/phases/02-explore-inputs-and-context-layer/02-CONTEXT.md` - Explicit context selection and saved-place selection boundary.
- `.planning/phases/03-ai-route-generation-and-streaming/03-CONTEXT.md` - Route event, route history, and structured route contract decisions that Phase 4 consumes.
- `.planning/phases/03-ai-route-generation-and-streaming/03-AI-SPEC.md` - AI route output and evaluation contract for the generated route data.

### Research and Codebase Map

- `.planning/research/FEATURES.md` - Explore map, AI route, and route-display feature framing.
- `.planning/research/SUMMARY.md` - Roadmap shape and implementation warnings for map and AI integration.
- `.planning/codebase/STRUCTURE.md` - Where Explore, map, AI, and test source files live.
- `.planning/codebase/STACK.md` - Current Nuxt, Mapbox GL, MapLibre, Pinia, and verification stack.
- `.planning/codebase/CONCERNS.md` - Map stack overlap, module-level Mapbox singleton, and map behavior test gaps.

### Existing Explore, AI Route, and Map Source

- `pages/explore.vue` - Current Explore map page, active AI point mapping, and prototype route drawing watch.
- `components/explore/map-view.client.vue` - Mapbox container setup and lifecycle hook.
- `components/explore/route-panel.vue` - Current sidebar route list, stats, generation controls, route history, and follow-up placement.
- `components/explore/route-marker.ts` - Prototype generated-marker and popup rendering.
- `components/explore/context-selector.vue` - Saved-place and diary-log context selection surface.
- `components/explore/candidate-places.vue` - Candidate-place context surface from Phase 2.
- `composables/use-mapbox.ts` - Current Mapbox singleton, marker creation, route line drawing, bounds fitting, spin/pause behavior, and cleanup.
- `composables/use-ai-route-session.ts` - Client SSE route session state, active variant, active points, route variants, and follow-up submission.
- `lib/ai/route-contract.ts` - Route point and route event schema with coordinates, day grouping, duration, rationale, confidence, distance, and optional cost metadata.
- `lib/db/schema/ai-route.ts` - Persisted route session, variant, point, and event-log schema.
- `lib/db/queries/ai-route.ts` - Ownership-safe route persistence and route point ordering.
- `stores/location.ts` - Existing saved-location and diary-log point conversion patterns that inform user-owned point styling.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `use-ai-route-session.ts`: Already accumulates `activePoints` from SSE route events, which Phase 4 can render progressively as route points arrive.
- `pages/explore.vue`: Already maps AI route points into Mapbox-compatible points, calls `addMarkers`, `drawRouteLine`, and `fitToRoute`, and can be evolved from whole-route redraw toward progressive/section-aware rendering.
- `use-mapbox.ts`: Provides marker creation, route-line drawing, route fitting, and animation primitives, but currently redraws a single route source/layer and uses module-level shared state.
- `route-marker.ts`: Provides a prototype generated route marker and popup; Phase 4 can replace or extend it for day/selection/current-location styling.
- `route-panel.vue`: Already computes place count, day count, estimated hours, and lists active route points; this is the natural home for day selector, route summary, and per-leg distance details.
- `stores/location.ts`: Existing helpers convert saved locations and diary logs to map points and can inform how user-owned/current-location points differ from generated AI route points.

### Established Patterns

- Explore components use kebab-case file names and Nuxt auto-imported components.
- Client state is composable-driven for Explore and route sessions, while user-owned persisted data stays behind authenticated server routes.
- Route data should flow through typed schemas from `lib/ai/route-contract.ts`; Phase 4 should not invent an untyped map-only route shape.
- Provider credentials remain server-only unless explicitly safe for public runtime config. Phase 4 should not add client provider secrets.
- Map lifecycle cleanup matters because `use-mapbox.ts` owns module-level map state, active markers, timers, and animation frames.

### Integration Points

- The route event stream from `/api/ai/route` feeds `use-ai-route-session.ts`, which feeds the Explore map and sidebar.
- Day selector state should connect to route point filtering, map marker/line rendering, and sidebar route details.
- Distance labels should use `RoutePoint.approximateDistanceMeters` or derived leg metadata if the planner introduces a safe typed helper.
- Saved places/current location connect through Phase 2 context selection and should appear in route viewing only when intentionally relevant and visually distinct.
- Focused verification should cover route point ordering, selected-day filtering, map-rendering state transforms, and graceful missing-distance behavior before relying on manual browser checks.

</code_context>

<specifics>
## Specific Ideas

- User wants route points to appear point-by-point as SSE events arrive.
- User wants route line detail to be emphasized when the user is zoomed close enough to see route lines clearly.
- User wants day grouping as a segmented selector.
- User wants selecting a day to isolate that section of the route from the full route.
- User wants generated route points to be the primary markers during route viewing.
- User wants saved/user places shown while selecting route context, not mixed into the generated route map by default.
- User wants current-location or user-owned markers to look different from generated route points when shown.
- User wants per-leg distance labels on the map and both per-leg plus total summary distance in the sidebar.

</specifics>

<deferred>
## Deferred Ideas

- Rich place popups with photos, reviews, ratings, costs, and community visit signals belong to Phase 5.
- Weather-aware route tips and what-to-take guidance belong to Phase 5.
- Saving generated routes or selected places into the diary belongs to Phase 6.

</deferred>

---

*Phase: 4-Animated Map Route Experience*
*Context gathered: 2026-05-10*
