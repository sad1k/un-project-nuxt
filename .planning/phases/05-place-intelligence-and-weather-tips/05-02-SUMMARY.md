---
phase: 05-place-intelligence-and-weather-tips
plan: 02
subsystem: ui
tags: [explore, mapbox, place-popups, popup-renderer]
requires:
  - phase: 05-place-intelligence-and-weather-tips
    provides: Plan 01 place intelligence endpoint and model
provides:
  - Photo-first safe popup renderer for generated route places
  - Lazy client place intelligence composable with variant-scoped cache
  - Mapbox marker integration for async rich popup HTML
affects: [phase-05-weather, phase-06-diary-save]
tech-stack:
  added: []
  patterns: [pure popup HTML renderer, async popup content resolver, client enrichment cache]
key-files:
  created:
    - components/explore/place-popup.ts
    - composables/use-place-intelligence.ts
    - tests/server/place-popup-renderer.test.mjs
  modified:
    - components/explore/route-marker.ts
    - composables/use-mapbox.ts
    - pages/explore.vue
key-decisions:
  - "Popup rendering is pure and escapes all dynamic strings before HTML insertion."
  - "Generated markers load rich place intelligence lazily and keep immediate loading/fallback HTML."
  - "Client code does not reference server-only provider keys or provider URLs."
patterns-established:
  - "Mapbox marker popups accept async generated-route HTML resolvers from page-level composables."
requirements-completed: [PLACE-01, PLACE-02, PLACE-03, PLACE-04, PLACE-05, PLACE-06]
duration: inline
completed: 2026-05-18
---

# Phase 5 Plan 02: Photo-First Rich Place Popups

**Generated route markers now open safe photo-first popups with sourced place details and explicit missing-data placeholders**

## Performance

- **Duration:** Inline execution and verification
- **Started:** 2026-05-18
- **Completed:** 2026-05-18
- **Tasks:** 5 completed
- **Files modified:** 6

## Accomplishments

- Added `components/explore/place-popup.ts` as a pure photo-first popup renderer for `PlaceIntelligence`.
- Added `use-place-intelligence.ts` to fetch and cache generated route point enrichment by variant plus route point identity.
- Wired `pages/explore.vue` and `use-mapbox.ts` so generated marker hover/click can show loading state, fetch enrichment, and render rich popup HTML.
- Kept current-location and user-place markers on simple fallback labels unless explicit intelligence support is added later.

## Task Commits

No task commits were created in this Codex App execution because the implementation was already present and this run reconciled verification plus GSD artifacts.

1. **Task 1: Add popup renderer tests first** - verified present
2. **Task 2: Implement safe photo-first popup renderer** - verified present
3. **Task 3: Add client place intelligence state** - verified present
4. **Task 4: Wire rich popups into Mapbox route markers** - verified present
5. **Task 5: Run popup-focused verification** - verified

## Files Created/Modified

- `components/explore/place-popup.ts` - Escaped, photo-first popup HTML renderer with placeholders, source labels, and community uncertainty copy.
- `composables/use-place-intelligence.ts` - Lazy generated-point enrichment fetcher/cache with unavailable fallback.
- `components/explore/route-marker.ts` - Distinct marker styling and escaped fallback popup labels.
- `composables/use-mapbox.ts` - Async popup resolver support with loading and fallback states.
- `pages/explore.vue` - Generated route markers request rich popup HTML from `usePlaceIntelligence`.
- `tests/server/place-popup-renderer.test.mjs` - Source-level popup renderer and integration checks.

## Decisions Made

- Photo markup is emitted before the popup body so provider/app photos become the first impression when available.
- Missing sections render as compact placeholders instead of disappearing.
- Rich popup loading is non-blocking; the marker opens immediately and updates when enrichment resolves.

## Deviations from Plan

None - plan behavior is implemented as written.

## Issues Encountered

- Browser-level visual validation is still pending in the Phase 5 human checkpoint.
- Node/npm commands require elevated execution in this Codex App session because sandboxed Node startup fails with `EPERM` on `C:\Users\misha`.

## Verification

- `node scripts/run-node-tests.mjs tests/server/place-intelligence.test.mjs tests/server/place-popup-renderer.test.mjs tests/server/weather-tips.test.mjs` passed: 18/18.
- `npm run test:server` passed: 75/75.
- `npm run lint:source` passed with 11 existing console warnings and 0 errors.
- Client-source secret grep for provider keys and secrets returned no matches.
- `npm run typecheck` remains blocked by pre-existing unrelated project-wide errors documented in the final Phase 5 summary.

## User Setup Required

None - no additional external service configuration is required for the popup UI. Google Places remains optional from Plan 01.

## Next Phase Readiness

Plan 03 can add route-wide weather guidance in the sidebar while leaving popup weather references incidental.

---
*Phase: 05-place-intelligence-and-weather-tips*
*Completed: 2026-05-18*
