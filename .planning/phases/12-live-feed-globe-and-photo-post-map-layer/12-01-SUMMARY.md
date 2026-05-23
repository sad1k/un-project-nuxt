---
phase: 12-live-feed-globe-and-photo-post-map-layer
plan: 12-01
type: implementation-summary
status: complete
completed_at: "2026-05-22T19:35:00.000Z"
requirements_addressed:
  - LIVEGLOBE-01
  - LIVEGLOBE-05
  - LIVEGLOBE-06
---

# 12-01 Summary: Public Feed Globe Contract

## Outcome

Created the safe public feed-globe data contract and hardened image-to-feed publishing so only current-user public, visible, coordinate-backed place photos can become feed/globe posts.

## Changed Files

| File | Purpose |
|------|---------|
| `lib/db/queries/post.ts` | Adds public feed-globe query/serializer, safe public place metadata on feed reads, feed publish eligibility checks, and publish image readiness metadata. |
| `server/api/feed.get.ts` | Continues to serve the normal public feed through the enriched query shape. |
| `server/api/posts/index.post.ts` | Validates owner image and public/visible/coordinate-backed eligibility before creating a post. |
| `server/api/posts/my-images.get.ts` | Uses the publish-focused image helper so the UI can understand readiness and posted state. |
| `server/api/public/feed-globe.get.ts` | Adds unauthenticated public globe read endpoint returning serialized safe post points. |
| `tests/server/feed-globe-public.test.mjs` | Locks public globe filtering, serializer shape, unauthenticated read boundary, and private-field exclusions. |
| `tests/server/feed-publish-public-photo.test.mjs` | Locks authenticated publish eligibility, duplicate conflict preservation, and publish image readiness metadata. |

## Decisions

- The public globe API returns image URLs instead of raw storage keys.
- Public globe posts are derived from existing `post` plus `locationLogImage`; no new social/globe table was added.
- `/api/posts` now rejects private, hidden, unplaced, or coordinate-less images before `createPost`.
- The globe endpoint accepts `limit` and `since` so later live/polling code can reuse the same safe serializer.

## Verification

| Check | Result |
|-------|--------|
| `node scripts/run-node-tests.mjs tests/server/feed-globe-public.test.mjs tests/server/feed-publish-public-photo.test.mjs tests/server/public-place-photos.test.mjs` | Passed, 13/13 tests. |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- Authenticated publish is owner-scoped: yes.
- Public globe reads are unauthenticated: yes.
- Private diary/image fields are excluded from globe payloads: yes.
- Duplicate post conflict behavior remains covered: yes.

## PLAN COMPLETE

