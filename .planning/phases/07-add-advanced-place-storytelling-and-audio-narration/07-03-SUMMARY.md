---
phase: 07-add-advanced-place-storytelling-and-audio-narration
plan: 03
subsystem: explore-place-story-offline
tags:
  - explore
  - place-story
  - offline
  - cache-api
requires:
  - .planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-01-SUMMARY.md
  - .planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-02-SUMMARY.md
provides:
  - explicit saved-audio offline playback state
  - offline unavailable state for unsaved stories
  - Phase 7 verification artifact
affects:
  - composables/use-place-story.ts
  - components/explore/place-story-card.vue
tech-stack:
  added: []
  patterns:
    - browser Cache API explicit save/remove
    - no broad service-worker media cache
key-files:
  created:
    - tests/server/place-story-offline.test.mjs
    - .planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-VERIFICATION.md
  modified:
    - composables/use-place-story.ts
    - components/explore/place-story-card.vue
    - server/api/explore/place-story/audio.get.ts
    - tests/server/place-story-ui.test.mjs
key-decisions:
  - Offline story audio is saved only when the user explicitly taps Save.
  - Offline playback uses a route/session/variant/routePoint-scoped authenticated audio URL as the cache request key.
  - The existing route-generation service worker remains notification-only; story audio uses window Cache API.
requirements-completed:
  - ADVPLACE-02
  - ADVPLACE-03
duration: "Wave 3"
completed: 2026-05-18
---

# Phase 7 Plan 03: Explicit Offline Story Audio Summary

Added explicit offline save/remove support for generated place story audio and completed the Phase 7 verification pass.

## What Changed

- Extended `use-place-story.ts` with Cache API support using `wanderlog-place-story-audio-v1`.
- Added save, remove, checking, saved, unsupported, and unavailable-offline states.
- Updated playback resolution so offline playback uses a cached audio response and unsaved offline playback fails visibly without attempting generation.
- Updated the story card with compact offline controls and status text.
- Added tests proving offline save is explicit, unsaved offline stories do not queue generation, and the service worker remains notification-scoped.
- Fixed the authenticated audio endpoint response body type found during typecheck.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/place-story-offline.test.mjs tests/server/place-story-ui.test.mjs`
- PASS: `pnpm test:server` (104/104)
- PASS: `pnpm lint:source` (warnings only from pre-existing console usage)
- PASS: `pnpm exec drizzle-kit push` (schema applied; emitted existing `tsconfig.json` warning)
- PASS: Nuxt dev server compiled and `GET http://127.0.0.1:3000/explore` returned 200
- FAIL: `pnpm typecheck` remains blocked by existing non-Phase-7 errors; Phase 7's local audio endpoint type issue was fixed and did not recur
- TIMEOUT: `pnpm build` timed out after about 4 minutes, matching the Phase 6 release blocker pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Live authenticated audio generation/playback was not manually exercised because it requires a generated route, auth session, provider credentials, and story-worthy provider data.
- Production release remains blocked by existing typecheck/build issues outside Phase 7.

## Next Phase Readiness

Phase 7 implementation is complete from the planned source and automated verification perspective. Manual UAT should verify a real generated route story, weak-support unavailable state, explicit offline save/remove, and unsaved offline behavior once credentials and test route data are available.
