---
phase: 02-explore-inputs-and-context-layer
plan: 01
subsystem: explore-search
tags: [explore, typeahead, mapbox, nominatim, server]
requires:
  - 01-explore-scope-and-verification-foundation
provides:
  - Provider-neutral city suggestion types
  - Authenticated city suggest/retrieve endpoints
  - Safer Nominatim fallback search path
affects: [phase-3-ai-route-generation, phase-4-map-route-experience]
tech-stack:
  added: []
  patterns:
    - Provider-normalized search DTOs under lib/explore
    - Focused Node source-contract tests under tests/server
key-files:
  created:
    - lib/explore/search.ts
    - lib/explore/context.ts
    - server/api/explore/city-suggest.get.ts
    - server/api/explore/city-retrieve.get.ts
    - tests/server/explore-search.test.mjs
  modified:
    - lib/db/schema/search-location.ts
    - server/api/search-locations.get.ts
key-decisions:
  - "Use Mapbox Search Box when configured and fall back to Nominatim without exposing provider errors."
  - "Normalize Mapbox/Nominatim into stable ExploreCitySuggestion and SelectedExploreCity shapes before UI or AI code consumes them."
patterns-established:
  - "Explore request/search contracts live in lib/explore instead of component-local state."
requirements-completed:
  - EXPIN-01
  - EXPIN-04
duration: 35 min
completed: 2026-05-09
---

# Phase 2 Plan 01: Provider Search Foundation Summary

**City search now has a typed provider boundary for live typeahead and future AI route prompts.**

## Accomplishments

- Added provider-neutral Explore search and request-context types.
- Added authenticated `/api/explore/city-suggest` and `/api/explore/city-retrieve` endpoints.
- Kept Mapbox as the preferred provider when configured, with a sanitized Nominatim fallback.
- Reworked `/api/search-locations` to use `URLSearchParams`, normalized cache keys, and no debug logging.
- Added focused server tests that lock search normalization and endpoint construction behavior.

## Deviations from Plan

None.

## Verification

- `npm run test:server` passed.
- `npm run lint:source -- --quiet` passed after Wave 2/3 lint fixes.

