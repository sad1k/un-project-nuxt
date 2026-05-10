# Phase 2: Explore Inputs and Context Layer - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the non-AI input and context layer for Explore. It implements city autocomplete, trip duration, interests, filters, current-location opt-in, saved-place selection, diary-log context selection, and first-visit candidate/popular-place context. It prepares a typed request context for Phase 3 AI route generation, but does not implement AI streaming, AI conversation persistence, generated route history storage, or map route rendering.

</domain>

<decisions>
## Implementation Decisions

### City Autocomplete

- **D-01:** City search should feel like live typeahead, not a submit-only form.
- **D-02:** Use a Mapbox-first provider strategy for Explore city autocomplete and candidate/popular-place lookup when configuration is available.
- **D-03:** Keep the existing Nominatim search route as a fallback path so Explore can still work without Mapbox Search Box configuration.
- **D-04:** If Mapbox Search Box is used, planning should account for the suggest -> retrieve flow and shared session token, so the app stores the selected city's stable provider identity, display name, and coordinates rather than only raw text.
- **D-05:** Existing `server/api/search-locations.get.ts` needs hardening before it becomes a live typeahead fallback: URL-safe query construction, normalized cache key, no debug logging, and provider error handling that does not leak sensitive details.

### Explore UI and Request Context

- **D-06:** Refactor `components/explore/RoutePanel.vue` and related Explore components to better match the app design system and improve UX; the existing panel is a prototype, not final UI.
- **D-07:** Do not pass raw component state directly to the future AI endpoint. Phase 2 should produce a typed Explore request context object that contains the selected city, coordinates/provider id, days, interests, filters, current-location choice, selected saved places, selected diary logs, and candidate/popular places.
- **D-08:** Trip duration, interests, and filters should be treated as first-class route-planning inputs and kept in a reusable composable/store boundary, not buried only in the route panel component.
- **D-09:** The agent/planner may choose exact control shapes, but they should be design-system-aligned and usable on both desktop and mobile Explore layouts.

### Personal Context Selection

- **D-10:** Saved places and prior diary logs can be passed into the AI request context, but selection should be explicit and understandable to the user rather than silently including all personal history.
- **D-11:** Current location should be opt-in and included only when browser permission/data is available. The UI should gracefully handle denied permission, unavailable geolocation, and unsupported browser states.
- **D-12:** Context selection should prepare bounded data for Phase 3, avoiding large or sensitive raw diary payloads in client state.

### Candidate Places, Popular Places, and Filters

- **D-13:** Phase 2 should support first-visit/empty-state candidate content: popular places for the selected city where provider or app data is available.
- **D-14:** Candidate/popular places should be filterable with the same filter model intended for later generated route results, so Phase 3 and Phase 4 can reuse the state shape.
- **D-15:** Generated route history is desirable, but persistence of AI generations/conversations belongs to Phase 3. Phase 2 may reserve UI/state hooks for history but should not create AI history storage.

### the agent's Discretion

- The agent/planner may choose the exact Mapbox integration boundary, including whether to proxy Search Box calls through Nitro or use safe browser-side public configuration, as long as provider tokens are handled according to vendor and project security requirements.
- The agent/planner may choose the exact Explore state module shape, component split, and filter taxonomy, as long as the resulting request context is typed, testable, and usable by Phase 3.
- The agent/planner may choose how many candidate/popular places to show by default and how to rank them, as long as the UI does not fabricate popularity signals.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, and constraints.
- `.planning/REQUIREMENTS.md` - Requirement IDs EXPIN-01 through EXPIN-05 and v1/v2 scope boundaries.
- `.planning/ROADMAP.md` - Phase 2 goal and success criteria.
- `.planning/STATE.md` - Current workflow state and next-step context.
- `.planning/phases/01-explore-scope-and-verification-foundation/01-CONTEXT.md` - Locked Explore flow and prior decisions.

### Research and Codebase Map

- `.planning/research/FEATURES.md` - Explore feature categories and v1/v2 framing.
- `.planning/research/SUMMARY.md` - Roadmap shape and implementation warnings.
- `.planning/codebase/STRUCTURE.md` - Where to add source files.
- `.planning/codebase/STACK.md` - Nuxt, Pinia, Nitro, map, and validation stack.
- `.planning/codebase/CONVENTIONS.md` - File naming, API, validation, and UI conventions.
- `.planning/codebase/CONCERNS.md` - Existing Nominatim, Mapbox, map, and verification risks.

### Existing Explore and Search Source

- `pages/explore.vue` - Current Explore route entry and prototype composition.
- `components/explore/` - Prototype Explore UI components to refactor, not preserve exactly.
- `components/explore/RoutePanel.vue` - Existing route input panel and prototype days/interests controls.
- `components/app/search-locations.vue` - Existing explicit search UI using `/api/search-locations`.
- `composables/useRouteGenerator.ts` - Mock route generation state that should be replaced or wrapped by a typed request-context model.
- `server/api/search-locations.get.ts` - Existing Nominatim-backed search route and fallback candidate.
- `stores/location.ts` - Existing saved locations/logs state and map-point helpers.
- `lib/db/queries/location.ts` - Existing user-owned location and location-log query patterns.

### External Provider Docs

- `https://docs.mapbox.com/api/search/search-box/` - Mapbox Search Box API suggest/retrieve autocomplete model.
- `https://docs.mapbox.com/mapbox-search-js/guides/` - Mapbox Search JS guidance for client-side search/autocomplete behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `pages/explore.vue`: Provides the full-screen Explore shell and component composition, but currently wires directly to mocked route points.
- `components/explore/RoutePanel.vue`: Contains prototype controls for destination, duration, interests, stats, and generation button.
- `components/app/search-locations.vue`: Demonstrates the current Nominatim search flow and result selection event pattern.
- `server/api/search-locations.get.ts`: Provides an authenticated, cached location search endpoint that can become the Nominatim fallback after hardening.
- `stores/location.ts`: Provides saved user locations/logs and helpers for converting them to map points.
- `lib/db/queries/location.ts`: Shows ownership-safe location/log query patterns with explicit `userId` filtering.

### Established Patterns

- Authenticated endpoints should use `utils/define-authenticated-handler.ts`.
- Request and query inputs should be validated with Zod or existing schema-derived validators.
- User-owned data must be filtered by authenticated `userId`.
- Provider credentials and sensitive configuration belong server-side unless a provider explicitly supports safe public browser tokens.
- New source files should use kebab-case names to satisfy the existing filename lint rule.

### Integration Points

- Explore UI controls should feed a typed context boundary consumed later by Phase 3 AI route generation.
- City autocomplete connects to Mapbox Search Box when configured and to the existing Nominatim route as fallback.
- Saved places and diary logs connect to existing location/location-log data structures.
- Candidate/popular places and filters should be shaped for later reuse by generated route display and map filtering.

</code_context>

<specifics>
## Specific Ideas

- User prefers live typeahead for city autocomplete.
- User specifically asked to research Mapbox API as the likely autocomplete/provider option.
- User wants `RoutePanel` and related Explore UI refactored toward a better UI/UX that correlates with the project's design system.
- User is open to passing the input/context into the AI request, but wants a better approach if available; the locked approach is a typed request context rather than raw UI state.
- User suggested adding generation history and popular places on first attendance/first page visit.
- Generation history is preserved as an important idea, but persistent AI history belongs to Phase 3.
- Popular places belong in Phase 2 as first-visit or post-city-selection candidate content.

</specifics>

<deferred>
## Deferred Ideas

- Persisted AI generation history and conversation/message storage belong to Phase 3: AI Route Generation and Streaming.
- Rendering generated route markers, route line, day groups, and map animations belongs to Phase 4.
- Place popup reviews/photos/cost/community signals beyond candidate/popular-place context belong to Phase 5 unless planning finds a very small provider-backed slice needed for Phase 2 candidates.

</deferred>

---

*Phase: 2-Explore Inputs and Context Layer*
*Context gathered: 2026-05-09*
