---
phase: 07-add-advanced-place-storytelling-and-audio-narration
plan: 02
subsystem: explore-place-story-ui
tags:
  - explore
  - place-story
  - audio-player
  - map-popup
requires:
  - .planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-01-SUMMARY.md
provides:
  - route-sidebar place story card
  - explicit-tap story playback controls
  - map popup story CTA
affects:
  - components/explore
  - composables
  - pages/explore.vue
tech-stack:
  added: []
  patterns:
    - Vue composable client playback state
    - Mapbox popup callback wiring
key-files:
  created:
    - components/explore/place-story-card.vue
    - composables/use-place-story.ts
    - tests/server/place-story-ui.test.mjs
  modified:
    - components/explore/route-panel.vue
    - components/explore/place-popup.ts
    - composables/use-mapbox.ts
    - pages/explore.vue
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - Route sidebar owns story playback; popups expose only a compact "Listen to story" CTA.
  - Audio generation and playback are initiated only by button clicks in the story card.
  - The UI exposes no voice/language selector and no transcript/story text beyond compact status/source cues.
requirements-completed:
  - ADVPLACE-01
  - ADVPLACE-02
duration: "Wave 2"
completed: 2026-05-18
---

# Phase 7 Plan 02: Route Sidebar Story Player Summary

Added the user-facing story experience inside the Explore route sidebar, with Mapbox popups acting only as a small entry point that focuses the selected route point's story card.

## What Changed

- Added `use-place-story.ts` for status loading, explicit generation, playback state, progress, pause, replay, and cleanup.
- Added `place-story-card.vue` with compact story status, source note, AI voice disclosure, and basic player controls.
- Updated `route-panel.vue` to keep a selected story route point and render the story card above route points.
- Updated `place-popup.ts`, `use-mapbox.ts`, and `pages/explore.vue` so generated place popups can show "Listen to story" and focus the sidebar story card.
- Added focused UI source tests covering popup scope, explicit tap behavior, no transcript, and no voice/language selector.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/place-story-ui.test.mjs`
- PASS: `pnpm lint:source`

`pnpm lint:source` exits successfully with existing unrelated console warnings.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Manual browser playback was not performed in this wave because generated audio depends on live credentials, route data, and the schema push planned for final verification.

## Next Phase Readiness

Ready for `07-03-PLAN.md`: offline save/remove states can extend the existing `usePlaceStory` state and `PlaceStoryCard` controls.

