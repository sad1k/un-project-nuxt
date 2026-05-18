---
phase: 07-add-advanced-place-storytelling-and-audio-narration
plan: 01
subsystem: explore-place-story-server
tags:
  - explore
  - place-story
  - tts
  - audio
requires:
  - .planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-01-PLAN.md
provides:
  - route-scoped place story contract
  - authenticated story status/generation/audio endpoints
  - server-only TTS adapter and audio storage path
affects:
  - lib/explore
  - lib/db
  - server/api/explore
tech-stack:
  added: []
  patterns:
    - native fetch provider adapter
    - Drizzle route-owned persistence table
    - authenticated Nitro endpoint
key-files:
  created:
    - lib/explore/place-story.ts
    - lib/explore/place-story-provider.ts
    - lib/db/schema/route-place-story.ts
    - lib/db/queries/route-place-story.ts
    - server/api/explore/place-story.get.ts
    - server/api/explore/place-story/generate.post.ts
    - server/api/explore/place-story/audio.get.ts
    - tests/server/place-story-contract.test.mjs
    - tests/server/place-story-server.test.mjs
  modified:
    - lib/db/schema/index.ts
    - lib/env.ts
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - Story audio is stored behind an authenticated server audio endpoint, not exposed as a public object URL.
  - One default TTS voice is server-configurable through `OPENAI_TTS_VOICE`; `ADVPLACE-02` remains partial/deferred.
  - Weak factual support is persisted as an unavailable story state and never calls TTS.
requirements-completed:
  - ADVPLACE-01
  - ADVPLACE-02
  - ADVPLACE-03
duration: "Wave 1"
completed: 2026-05-18
---

# Phase 7 Plan 01: Grounded Story Server Foundation Summary

Built the server-side foundation for generated place story narration: a typed story contract, user-owned route story persistence, source support gating, native-fetch OpenAI TTS integration, S3-backed audio object storage, and authenticated status/generate/audio endpoints.

## What Changed

- Added `PlaceStoryResponseSchema` and related request/audio/source-support schemas with no transcript or long story body exposed to clients.
- Added `routePlaceStory` persistence with a unique user/session/variant/routePoint scope.
- Added route-point ownership queries for story status, unavailable, failed, and available audio states.
- Added a grounded story provider that builds narration from provider facts plus route context and refuses weak support before TTS.
- Added authenticated Explore endpoints for story status, explicit generation, and private audio streaming.
- Added focused Node source tests for contracts, ownership gates, server-only credentials, and support gating.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/place-story-contract.test.mjs tests/server/place-story-server.test.mjs`
- PASS: `pnpm lint:source`
- PASS: `git diff --check` for Wave 1 files

`pnpm lint:source` still reports the repository's existing console warnings as warnings only; it exits successfully.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None for Wave 1. A database schema push is still required before exercising the new `routePlaceStory` table against a live local database.

## Next Phase Readiness

Ready for `07-02-PLAN.md`: the UI can call `/api/explore/place-story`, `/api/explore/place-story/generate`, and `/api/explore/place-story/audio` with `sessionId`, `variantId`, and `routePointId`.

