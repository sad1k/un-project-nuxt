---
phase: 05-place-intelligence-and-weather-tips
plan: 01
subsystem: api
tags: [explore, place-intelligence, google-places, community-signals]
requires:
  - phase: 03-ai-route-generation-and-streaming
    provides: User-owned route variants and generated route points
  - phase: 04-animated-map-route-experience
    provides: Route map point display contract
provides:
  - Sourced, missing-data-aware place intelligence model
  - Optional server-only Google Places adapter boundary
  - Aggregate app-community visit signal helper
  - Authenticated place intelligence endpoint for generated route points
affects: [phase-05-popups, phase-06-diary-save, observability-security]
tech-stack:
  added: []
  patterns: [server-only provider adapter, explicit missing-data slots, aggregate community signal]
key-files:
  created:
    - lib/explore/place-intelligence.ts
    - lib/explore/place-intelligence-providers.ts
    - lib/db/queries/place-intelligence.ts
    - server/api/explore/place-intelligence.get.ts
    - tests/server/place-intelligence.test.mjs
  modified:
    - lib/env.ts
    - lib/db/queries/ai-route.ts
key-decisions:
  - "Google Places enrichment is optional and server-only through `GOOGLE_PLACES_API_KEY`."
  - "Provider, route, app, AI, and missing data all carry source/confidence metadata."
  - "Community presence uses aggregate app visits only and returns no user identities or diary text."
patterns-established:
  - "Place enrichment is shaped through a pure model before API/UI exposure."
requirements-completed: [PLACE-01, PLACE-02, PLACE-03, PLACE-04, PLACE-05, PLACE-06]
duration: inline
completed: 2026-05-18
---

# Phase 5 Plan 01: Place Intelligence Contract and Endpoint

**Generated route points now have a sourced place intelligence contract with provider fallback and aggregate app-community signals**

## Performance

- **Duration:** Inline execution and verification
- **Started:** 2026-05-18
- **Completed:** 2026-05-18
- **Tasks:** 5 completed
- **Files modified:** 7

## Accomplishments

- Added a pure `PlaceIntelligence` model with photo, review, rating, cost, community, AI summary, weather reference, and explicit missing-data slots.
- Added optional Google Places fetching with explicit field masks and native `fetch`, guarded by server-only `GOOGLE_PLACES_API_KEY`.
- Added aggregate community visit and recent-activity signals from app data without exposing identities, diary descriptions, or raw visit rows.
- Added an authenticated `/api/explore/place-intelligence` endpoint that validates inputs and verifies generated route point ownership.

## Task Commits

No task commits were created in this Codex App execution because the implementation was already present and this run reconciled verification plus GSD artifacts.

1. **Task 1: Add place intelligence tests first** - verified present
2. **Task 2: Define place intelligence model and shaping helpers** - verified present
3. **Task 3: Add optional provider adapter boundary** - verified present
4. **Task 4: Add app-community aggregate query helper** - verified present
5. **Task 5: Add authenticated place intelligence endpoint** - verified present

## Files Created/Modified

- `lib/explore/place-intelligence.ts` - Place intelligence schemas, types, shaping helpers, missing slots, and price formatting.
- `lib/explore/place-intelligence-providers.ts` - Optional Google Places search/details normalization with explicit field masks.
- `lib/db/queries/place-intelligence.ts` - Aggregate app-community visit and recent-activity signal helper.
- `server/api/explore/place-intelligence.get.ts` - Authenticated endpoint that shapes route/provider/app data.
- `tests/server/place-intelligence.test.mjs` - Source-level tests for D-01 through D-10.
- `lib/env.ts` - Optional server-only `GOOGLE_PLACES_API_KEY`.
- `lib/db/queries/ai-route.ts` - Ownership-safe route point lookup for enrichment.

## Decisions Made

- Missing photos, reviews, ratings, cost, and community signals are first-class slots rather than silent omissions.
- Route-provided cost metadata remains valid when provider cost is unavailable, but it stays sourced as an AI route estimate.
- Weak app data produces no likely/currently-there claim.

## Deviations from Plan

None - plan behavior is implemented as written.

## Issues Encountered

- `headers` appears in `place-intelligence-providers.ts` because Google Places requires outbound server-side request headers. No raw provider headers are returned to clients.
- Node/npm commands require elevated execution in this Codex App session because sandboxed Node startup fails with `EPERM` on `C:\Users\misha`.

## Verification

- `node scripts/run-node-tests.mjs tests/server/place-intelligence.test.mjs tests/server/place-popup-renderer.test.mjs tests/server/weather-tips.test.mjs` passed: 18/18.
- `npm run test:server` passed: 75/75.
- `npm run lint:source` passed with 11 existing console warnings and 0 errors.
- Client-source secret grep for `GOOGLE_PLACES_API_KEY`, `places.googleapis.com`, `OPENAI_API_KEY`, `TURSO_AUTH_TOKEN`, and `S3_SECRET_KEY` in `components`, `pages`, `composables`, and `nuxt.config.ts` returned no matches.
- `npm run typecheck` remains blocked by pre-existing unrelated project-wide errors documented in `05-03-SUMMARY.md` once the final checkpoint completes.

## User Setup Required

Google Places enrichment is optional. If `GOOGLE_PLACES_API_KEY` is absent, provider fields degrade to explicit missing-data placeholders plus route/app data.

## Next Phase Readiness

Plan 02 can render generated route marker popups from the shaped `PlaceIntelligence` response without embedding provider logic in Mapbox marker code.

---
*Phase: 05-place-intelligence-and-weather-tips*
*Completed: 2026-05-18*
