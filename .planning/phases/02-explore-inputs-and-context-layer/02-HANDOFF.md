---
phase: 02-explore-inputs-and-context-layer
created: 2026-05-09
next_phase: 03-ai-route-generation
---

# Phase 2 Handoff

## Ready for Phase 3

Phase 3 should treat `useExploreContext().requestContext` as the client-side source for AI route generation input.

Important context fields:

- `city`: selected destination with provider id and coordinates.
- `selectedDays`: trip length.
- `interests`: route preference categories.
- `filters`: text/category/source filtering for candidate places.
- `currentLocation`: optional nearby context.
- `selectedSavedPlaceIds`: authenticated user's selected saved places.
- `selectedDiaryLogIds`: selected diary logs.
- `candidatePlaces`: selected starter/popular places.

## Suggested Phase 3 Entry Points

- `components/explore/route-panel.vue` generate button currently calls the mock `useRouteGenerator()`.
- Replace that call with the Phase 3 AI request/SSE orchestration while preserving the context controls.
- Keep `use-route-generator.ts` only as demo fallback until AI route streaming is implemented.
- Server prompt assembly should read full saved place/log details by id server-side, not trust client-provided saved content.

## Known Risks

- Full repository typecheck remains blocked by unrelated existing errors recorded in `02-VERIFICATION.md`.
- Mapbox candidate places are suggest-only in Phase 2; detailed POI retrieval can be added in a later map/place-detail phase.
- The Explore page requires a valid Mapbox public token to render the interactive map fully.

