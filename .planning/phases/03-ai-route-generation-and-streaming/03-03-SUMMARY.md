---
phase: 03-ai-route-generation-and-streaming
plan: 03
subsystem: client, ui, ai-streaming
tags: [nuxt, composables, sse, route-history, follow-up]
requires:
  - phase: 03-ai-route-generation-and-streaming
    provides: Plan 02 authenticated route stream endpoint
provides:
  - Client route stream session composable
  - Route variant history switcher
  - Follow-up refinement input
  - Explore route panel integration with AI route stream
  - Phase 4 map-rendering handoff
affects: [phase-04-map-route-rendering, phase-06-save-to-diary]
tech-stack:
  added: []
  patterns:
    - Client SSE consumption through a route session composable
    - Generated route variants keyed by activeVariantId
    - UI renders route fields only, not raw JSON
key-files:
  created:
    - composables/use-ai-route-session.ts
    - components/explore/route-history.vue
    - components/explore/route-follow-up.vue
    - tests/server/ai-route-client.test.mjs
    - .planning/phases/03-ai-route-generation-and-streaming/03-HANDOFF.md
  modified:
    - composables/use-route-generator.ts
    - components/explore/route-panel.vue
    - pages/explore.vue
key-decisions:
  - "Explore's primary generation action now uses useAiRouteSession instead of the mock route generator."
  - "The mock route generator remains as useRouteGeneratorFixture for isolated fallback/fixture use."
  - "Phase 3 exposes basic point display and map handoff while leaving full map route UX to Phase 4."
patterns-established:
  - "Client route state stores validated route events and points by variant id."
  - "Follow-up refinements include sessionId and activeVariantId."
requirements-completed:
  - AIROUTE-01
  - AIROUTE-02
  - AIROUTE-04
  - AIROUTE-05
  - AIROUTE-06
duration: 9min
completed: 2026-05-10
---

# Phase 3 Plan 3: Client Route Session and Follow-Up Summary

**Explore now consumes AI route events through switchable route variants and follow-up refinement UI**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-10T19:17:38+03:00
- **Completed:** 2026-05-10T19:26:11+03:00
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Added `use-ai-route-session.ts` to post `ExploreRequestContext` to `/api/ai/route`, consume SSE events, and track `sessionId`, `activeVariantId`, variants, warnings, and route points.
- Replaced the primary Explore route-generation action with the AI route session stream.
- Added route history and follow-up components for switching variants and refining the active route without making chat the first-run surface.
- Added source tests that check stream integration, variant switching, follow-up submission, and no raw JSON rendering.
- Added Phase 4 handoff documenting `RouteEventEnvelope`, route point fields, and map-rendering responsibilities.

## Task Commits

1. **Tasks 1-4: Client stream state, route UI, tests, and handoff** - `d826847` (`feat`)

**Plan metadata:** pending in docs commit

## Files Created/Modified

- `composables/use-ai-route-session.ts` - Client route stream state and follow-up submission.
- `composables/use-route-generator.ts` - Keeps old generator as fixture/fallback helper.
- `components/explore/route-panel.vue` - Uses AI route session for primary generation and renders route status/points.
- `components/explore/route-history.vue` - Variant switcher using `activeVariantId`.
- `components/explore/route-follow-up.vue` - Compact follow-up refinement input.
- `pages/explore.vue` - Feeds active route points into the existing map marker handoff.
- `tests/server/ai-route-client.test.mjs` - Source-level client integration checks.
- `.planning/phases/03-ai-route-generation-and-streaming/03-HANDOFF.md` - Phase 4 map handoff.

## Decisions Made

- Kept the UI map-first: route points, status, variant buttons, and short rationale are visible; raw event JSON is not.
- Follow-ups require an active session and variant, preventing stale route edits without context.
- Existing map marker utilities receive a simple coordinate projection now; Phase 4 owns richer marker styling, route lines, day selection, and animation.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

Manual browser/provider verification was not completed in this plan because real provider credentials are not configured in-test and remote Turso schema push remains blocked.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/ai-route-client.test.mjs`
- PASS: `pnpm exec eslint composables/use-ai-route-session.ts composables/use-route-generator.ts components/explore/route-panel.vue components/explore/route-history.vue components/explore/route-follow-up.vue pages/explore.vue tests/server/ai-route-client.test.mjs --no-warn-ignored`
- PASS: LSP diagnostics on route session composable and Explore route components
- PASS: `rg --fixed-strings "RouteEventEnvelope" .planning/phases/03-ai-route-generation-and-streaming/03-HANDOFF.md`
- NOT RUN: Manual browser check with live route generation and variant switching.

## User Setup Required

Manual browser verification should be run after provider credentials and database schema access are fixed:

- Generate a route and confirm raw JSON is not visible.
- Submit a follow-up and confirm a new route variant appears.
- Switch variants in route history.

## Next Phase Readiness

Phase 4 can consume `useAiRouteSession().activePoints` and the documented `RouteEventEnvelope`/route point fields for full map marker, line, day grouping, and animation work.

---
*Phase: 03-ai-route-generation-and-streaming*
*Completed: 2026-05-10*
