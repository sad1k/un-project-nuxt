---
phase: 12-live-feed-globe-and-photo-post-map-layer
plan: 12-02
type: implementation-summary
status: complete
completed_at: "2026-05-22T19:52:00.000Z"
requirements_addressed:
  - LIVEGLOBE-01
  - LIVEGLOBE-02
  - LIVEGLOBE-04
  - LIVEGLOBE-05
---

# 12-02 Summary: Feed Globe UI And Density

## Outcome

Added the feed globe surface, a dedicated Mapbox globe component, quick publish affordance improvements, safe public place labels in feed cards, and a pure density limiter that keeps only the newest bounded set visible in each local bucket.

## Changed Files

| File | Purpose |
|------|---------|
| `pages/feed.vue` | Replaces placeholder latest/popular tabs with feed/globe tab state and lazy client rendering for the globe. |
| `stores/feed.ts` | Adds safe public place metadata to the feed post type. |
| `components/feed/post-card.vue` | Shows the public place label when available instead of a hardcoded trip-place label. |
| `components/feed/feed-globe.client.vue` | Adds an isolated Mapbox globe with fog, spin, animated point markers, overflow markers, and popup-safe content. |
| `composables/use-feed-globe.ts` | Fetches public globe posts, deduplicates by post id, applies density limiting, and exposes render state. |
| `lib/feed/globe-density.ts` | Adds pure newest-first local-bucket density limiting with hidden and fading point ids plus overflow indicators. |
| `tests/server/feed-globe-density.test.mjs` | Locks density helper behavior and browser independence. |
| `tests/server/feed-globe-ui.test.mjs` | Locks feed tab wiring, Mapbox lifecycle isolation, popup-safe fields, and place-label rendering. |

## Decisions

- The feed globe owns its own Mapbox instance instead of using the Explore map singleton.
- The density limiter is pure TypeScript so live updates and initial loads use the same bounded view.
- Markers are used for the first implementation because the density helper keeps the rendered point count bounded; later work can switch to GeoJSON layers without changing the data contract.
- Feed cards only consume public place labels, not private diary/location text.

## Verification

| Check | Result |
|-------|--------|
| `node scripts/run-node-tests.mjs tests/server/feed-globe-density.test.mjs tests/server/feed-globe-ui.test.mjs tests/server/feed-globe-public.test.mjs tests/server/feed-publish-public-photo.test.mjs` | Passed, 17/17 tests. |
| `node scripts/run-node-tests.mjs tests/server/feed-globe-ui.test.mjs tests/server/feed-globe-density.test.mjs` | Passed, 10/10 tests after tab label cleanup. |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `/feed` keeps a normal list and adds a globe tab: yes.
- Globe Mapbox lifecycle is isolated from Explore: yes.
- Dense areas show max 4 visible points with overflow data: yes.
- Popups are limited to photo, place, author, and date: yes.

## PLAN COMPLETE

