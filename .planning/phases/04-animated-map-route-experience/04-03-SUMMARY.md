---
phase: 04-animated-map-route-experience
plan: 03
subsystem: ui
tags: [explore, route-days, distance-summary, map-sidebar]
requires:
  - phase: 04-animated-map-route-experience
    provides: Plan 01 route-map display model and Plan 02 Mapbox route rendering
provides:
  - Segmented route day selector shared by Explore map and sidebar
  - Sidebar per-leg distance details and route distance summary
  - Generated-route focus boundary that keeps saved places in explicit context selection
affects: [phase-05-place-intelligence, phase-06-diary-save]
tech-stack:
  added: []
  patterns: [shared Explore selected-day state, sidebar route distance summary]
key-files:
  created:
    - components/explore/route-day-selector.vue
    - components/explore/route-distance-summary.vue
  modified:
    - components/explore/route-panel.vue
    - pages/explore.vue
    - tests/server/explore-route-map.test.mjs
key-decisions:
  - "Route day selection is shared through `explore-selected-route-day` so map and sidebar isolate the same route section."
  - "Distance UI renders known leg labels and explicit missing-distance states instead of inventing values."
  - "Saved places and diary logs remain explicit route context inputs rather than default generated-route map overlays."
patterns-established:
  - "Route panel consumes pure route-map helpers for selected-day rows, legs, and distance totals."
requirements-completed: [MAP-03, MAP-04, MAP-05, MAP-06]
duration: inline
completed: 2026-05-18
---

# Phase 4 Plan 03: Route Controls and Distance Summary

**Shared day selection and sidebar distance details complete the generated-route map inspection loop**

## Performance

- **Duration:** Inline execution and verification
- **Started:** 2026-05-17T00:00:00Z
- **Completed:** 2026-05-18
- **Tasks:** 4 completed plus human-verification checkpoint prepared
- **Files modified:** 5

## Accomplishments

- Added a compact segmented day selector that appears for active route sessions and supports all-days plus per-day isolation.
- Wired selected-day state through `pages/explore.vue` and `components/explore/route-panel.vue` so map markers/line and sidebar rows use the same filtered route points.
- Added sidebar distance summary and per-leg labels using `buildRouteLegs` and `summarizeRouteDistance`.
- Confirmed saved places and diary logs remain in `context-selector.vue` as explicit route context, not a default generated-route overlay.

## Task Commits

No task commits were created in this Codex App execution because the relevant source changes were already present in the working tree and only the missing GSD summary artifact needed reconciliation.

1. **Task 1: Add segmented day selector** - verified present
2. **Task 2: Add sidebar distance summary and leg rows** - verified present
3. **Task 3: Preserve generated-route focus and context-selection boundary** - verified present
4. **Task 4: Run focused automated verification** - verified

## Files Created/Modified

- `components/explore/route-day-selector.vue` - Compact segmented all/day selector.
- `components/explore/route-distance-summary.vue` - Route total and per-leg distance panel with missing-data messaging.
- `components/explore/route-panel.vue` - Shared selected-day state, filtered route rows, route stats, weather tips, and distance summary placement.
- `pages/explore.vue` - Selected-day route section rendering for Mapbox markers, route line, labels, and camera fitting.
- `tests/server/explore-route-map.test.mjs` - Source-level assertions for selected-day and distance UI wiring.

## Decisions Made

- Keep an `All` segment so users can return to full-route overview after isolating a day.
- Show distance summary only when there are route legs, and call out missing estimates when some legs lack distance metadata.
- Keep rich place popup, weather, and save-to-diary scope out of this Phase 4 plan except for already-established integration boundaries.

## Deviations from Plan

None - plan behavior is implemented as written.

## Issues Encountered

- Node/npm commands fail inside the Codex sandbox with `EPERM: operation not permitted, lstat 'C:\Users\misha'`. Verification was rerun outside the sandbox with explicit escalation.
- `pnpm` and `corepack` were not on PATH in this app session, so equivalent `npm run ...` scripts were used.
- `npm run typecheck` remains blocked by pre-existing unrelated project type errors listed in the verification evidence below.

## Verification

- `node scripts/run-node-tests.mjs tests/server/explore-route-map.test.mjs` passed: 9/9.
- `npm run test:server` passed: 75/75.
- `npm run lint:source` passed with 11 existing console warnings and 0 errors.
- `npm run typecheck` failed on existing unrelated blockers in animated list slots, lightbox typings, file-upload argument shape, globe implicit `any`, DB schema/query typing, dashboard/location pages, OpenAI-compatible fetch headers, and the Sentry example route.
- Source checks confirmed `ExploreRouteDaySelector`, shared `selectedDay`, `ExploreRouteDistanceSummary`, route leg helpers, and saved-context boundaries are present.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 5 can enrich generated-route place popups and route tips using the Phase 4 map/sidebar surfaces without reworking route section selection or distance display.

---
*Phase: 04-animated-map-route-experience*
*Completed: 2026-05-18*
