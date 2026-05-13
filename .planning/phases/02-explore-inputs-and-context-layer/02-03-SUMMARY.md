---
phase: 02-explore-inputs-and-context-layer
plan: 03
subsystem: explore-personal-context
tags: [explore, saved-places, diary, current-location, candidate-places]
requires:
  - 02-01-provider-search-foundation
  - 02-02-ui-request-context-refactor
provides:
  - Authenticated Explore personal context endpoint
  - Candidate place endpoint with provider and fallback paths
  - Current location composable
  - Saved context and candidate place selectors
affects: [phase-3-ai-route-generation, phase-5-history-weather-diary]
tech-stack:
  added: []
  patterns:
    - Bounded personal context query shape
    - Fallback candidate-place generation when providers are unavailable
key-files:
  created:
    - lib/db/queries/explore-context.ts
    - server/api/explore/context.get.ts
    - server/api/explore/candidate-places.get.ts
    - composables/use-current-location.ts
    - components/explore/context-selector.vue
    - components/explore/candidate-places.vue
    - tests/server/explore-context.test.mjs
key-decisions:
  - "Expose only bounded saved-place and diary-log context to Explore, keyed by authenticated user id."
  - "Return starter candidate places even without Mapbox provider results so first-visit Explore has usable prompt context."
patterns-established:
  - "Personal context selectors add ids and selected candidate places into ExploreRequestContext for Phase 3 AI prompt assembly."
requirements-completed:
  - EXPIN-04
  - EXPIN-05
duration: 45 min
completed: 2026-05-09
---

# Phase 2 Plan 03: Personal and Candidate Context Summary

**Explore can now enrich the next AI request with saved places, diary logs, nearby context, and starter place candidates.**

## Accomplishments

- Added a bounded authenticated `/api/explore/context` endpoint for saved places and recent diary logs.
- Added `/api/explore/candidate-places` with Mapbox-backed suggestions when configured and local fallback starter ideas otherwise.
- Added `useCurrentLocation()` and wired the route panel current-location control.
- Added saved-place, diary-log, and candidate-place selectors to the Explore panel.
- Added source-contract tests for personal context shaping and candidate-place fallback behavior.

## Deviations from Plan

None.

## Verification

- `npm run test:server` passed 9 tests.
- `npm run lint:source -- --quiet` passed.
- `Invoke-WebRequest http://localhost:3000/explore` returned HTTP 200 with the dev server running.

