# Explore Contract

**Phase:** 01 - Explore Scope and Verification Foundation
**Status:** Execution handoff

## Target Flow

The full Explore target flow remains:

```text
city autocomplete -> days/interests -> AI route -> animated map -> save to diary
```

Explore is the primary AI route planning surface. Current files under `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts` are product-intent templates, not final implementation contracts.

## Decision Traceability

| Decision | Contract | Requirements | Roadmap phase |
|----------|----------|--------------|---------------|
| D-01 | Preserve the end-to-end flow: enter city with autocomplete, choose days/interests, generate an AI route, show it on an animated map, and save to diary. | EXPIN-01, EXPIN-02, EXPIN-03, AIROUTE-01, MAP-04, DIARY-01, FOUND-04 | Phase 2, Phase 3, Phase 4, Phase 6 |
| D-02 | Explore is the primary AI route planning surface, not a dashboard side widget. | FOUND-04, AIROUTE-01 | Phase 1, Phase 3 |
| D-03 | Preserve the intent of `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts`, while allowing implementation and visuals to change. | FOUND-04 | Phase 1 |
| D-04 | Generated routes need markers, route line, day grouping, map animations, search, filters, current location, saved places, costs, and distances. | EXPIN-04, EXPIN-05, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, PLACE-04 | Phase 2, Phase 4, Phase 5 |
| D-05 | Place popup opens from a place and shows info, pictures, reviews, rating, cost, and distance when data is available. | PLACE-01, PLACE-02, PLACE-03, PLACE-04, MAP-05 | Phase 5 |
| D-06 | Community signals show WanderLog visit counts and best-effort current-time presence only from real app data or explicitly marked estimates. | PLACE-05, PLACE-06, OBS-03 | Phase 5, Phase 6 |
| D-07 | AI must generate routes. | AIROUTE-01 | Phase 3 |
| D-08 | AI response text must stream while generation is running. | AIROUTE-02 | Phase 3 |
| D-09 | AI should use saved locations and diary logs as bounded user context. | EXPIN-05, AIROUTE-03, OBS-03 | Phase 2, Phase 3, Phase 6 |
| D-10 | User can ask follow-up questions to refine the route. | AIROUTE-04 | Phase 3 |
| D-11 | AI output must include structured route data for map rendering, not only prose. | AIROUTE-06, MAP-01, MAP-02, MAP-03 | Phase 3, Phase 4 |
| D-12 | Explore provides weather-correlated tips, especially what the user should take. | TIPS-01, TIPS-02 | Phase 5 |
| D-13 | Interactive history/storytelling with sound is desired but deferred until place data and popup foundations are stable. | ADVPLACE-01, ADVPLACE-02, ADVPLACE-03 | Deferred v2 |
| D-14 | Place pictures belong in the click popup and use provider/app image data when available. | PLACE-02 | Phase 5 |
| D-15 | Planning docs capture the Explore feature list. | FOUND-04 | Phase 1 |
| D-16 | Codebase map docs stay current-state only and must not imply planned AI/SSE/PWA features already exist. | FOUND-04 | Phase 1 |

## Later Phase Handoff

- Phase 2 owns city autocomplete, days/interests, search/filter controls, current location, saved places, and diary context.
- Phase 3 owns AI generation, streaming text, follow-ups, user-scoped persistence, and structured route output.
- Phase 4 owns markers, route line, day groups, map animations, distances, and saved-place overlay.
- Phase 5 owns popups, photos, reviews/ratings, cost, community visit/current-time signals, weather tips, and what-to-take guidance.
- Phase 6 owns saving generated routes/places into diary, ownership/security, observability, and release hardening.

## Do Not Do In Phase 1

- Do not add AI provider integration.
- Do not add new route-generation API endpoints.
- Do not rewrite map route behavior.
- Do not add weather, review, photo, cost, or place-data provider integration.
- Do not add push notifications.
- Do not add narrated audio history/storytelling.

## Current Prototype Boundary

- `components/explore/` is visual/product intent for the future Explore surface.
- `pages/explore.vue` is the current Explore route entry and can be reshaped by implementation phases.
- `composables/useRouteGenerator.ts` is mock route generation and should be replaced or wrapped by real AI-backed generation in Phase 3.
- `composables/useMapbox.ts` contains useful map route behavior for Phase 4, but its singleton lifecycle and lint blockers should be handled deliberately.

