---
phase: 04-animated-map-route-experience
plan: 01
subsystem: ui
tags: [explore, route-map, tests, distance]
requires:
  - phase: 03-ai-route-generation-and-streaming
    provides: RoutePoint contract with coordinates, day grouping, and distance metadata
provides:
  - Pure route-map display model for Explore map/sidebar rendering
  - Route day grouping, selected-day filtering, route legs, and distance summaries
  - Source-level regression tests for the route-map model
affects: [phase-04-map, phase-05-place-intelligence, phase-06-diary-save]
tech-stack:
  added: []
  patterns: [pure route display helpers, source-level node tests]
key-files:
  created:
    - lib/explore/route-map.ts
    - tests/server/explore-route-map.test.mjs
  modified: []
key-decisions:
  - "Route map/sidebar rendering uses a pure helper before Mapbox/Vue wiring."
  - "Missing distance estimates are represented explicitly instead of fabricated."
patterns-established:
  - "Route display helpers consume Phase 3 RoutePoint and return Mapbox/sidebar-ready structures."
requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-05, MAP-06]
duration: inline
completed: 2026-05-10
---

# Phase 4: Animated Map Route Experience Summary

**Pure Explore route-map model with tested day filtering, route legs, distance summaries, and marker-kind boundaries**

## Performance

- **Duration:** Inline execution
- **Started:** 2026-05-10
- **Completed:** 2026-05-10
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `lib/explore/route-map.ts` with route points, day groups, route legs, distance summaries, and marker-kind helpers.
- Added `tests/server/explore-route-map.test.mjs` coverage for the route-map model and its non-UI constraints.
- Preserved the Phase 3 route contract as the source of truth for coordinates, days, duration, and distance metadata.

## Task Commits

No commits were created during inline Codex App execution because the repository already had unrelated staged and dirty changes.

1. **Task 1: Add route map helper tests first** - not committed
2. **Task 2: Implement route display model helpers** - not committed

## Files Created/Modified

- `lib/explore/route-map.ts` - Pure route display model and distance helpers.
- `tests/server/explore-route-map.test.mjs` - Source-level tests for the route map model and later sidebar/page wiring.

## Decisions Made

- Use `RoutePoint.coordinates.long` as route-map longitude.
- Treat distance as optional and expose unavailable labels instead of inventing estimates.
- Distinguish `generated`, `current-location`, and `user-place` marker kinds in the shared display model.

## Deviations from Plan

### Auto-fixed Issues

**1. Test runner import constraint**
- **Found during:** Task 1
- **Issue:** The existing Node test runner does not import TypeScript files directly.
- **Fix:** Matched the project’s source-level `node:test` pattern instead of adding a loader or dependency.
- **Files modified:** `tests/server/explore-route-map.test.mjs`
- **Verification:** `pnpm test:server tests/server/explore-route-map.test.mjs`
- **Committed in:** not committed

**Total deviations:** 1 auto-fixed.
**Impact on plan:** Behavior is protected by source-level checks consistent with existing tests; no runtime dependency was added.

## Issues Encountered

None beyond the TypeScript import constraint documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can render route-map points, route legs, and distance labels through Mapbox without re-deriving route display state.

---
*Phase: 04-animated-map-route-experience*
*Completed: 2026-05-10*
