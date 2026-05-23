---
phase: 12-live-feed-globe-and-photo-post-map-layer
type: verification
status: source-verified-with-existing-release-blockers
verified_at: "2026-05-22T20:35:00.000Z"
---

# Phase 12 Verification

## Result

Phase 12 is implemented and focused-source verified. WanderLog now connects public photo feed posts to a public Mapbox globe tab:

1. Authenticated users can publish only their own public, visible, coordinate-backed photos to the feed.
2. `/feed` keeps the normal feed and adds a global globe tab.
3. Public globe reads are available to guests through a safe serializer.
4. Live/near-live arrivals use SSE with polling fallback.
5. Dense local areas are capped to the newest four visible points with overflow indicators.

## Requirement Evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| LIVEGLOBE-01 | Complete | `/api/posts` now validates owner image plus public/visible/public-coordinate eligibility before `createPost`; `tests/server/feed-publish-public-photo.test.mjs` covers eligibility and duplicate conflict behavior. |
| LIVEGLOBE-02 | Complete | `pages/feed.vue` has `feed`/`globe` tab state and renders `components/feed/feed-globe.client.vue`; `tests/server/feed-globe-ui.test.mjs` covers tab wiring. |
| LIVEGLOBE-03 | Complete | `server/api/public/feed-globe/stream.get.ts` streams safe public post batches; `composables/use-feed-globe.ts` uses `EventSource` and polling fallback; `tests/server/feed-globe-live.test.mjs` covers both paths. |
| LIVEGLOBE-04 | Complete | `lib/feed/globe-density.ts` caps visible points per bucket to four, tracks hidden/fading ids, and exposes overflow indicators; `tests/server/feed-globe-density.test.mjs` covers newest-first replacement and `+N` data. |
| LIVEGLOBE-05 | Complete | Public serializer and globe popup render only photo URL/alt, place, author display name/avatar, and date; `tests/server/feed-globe-public.test.mjs` and `tests/server/feed-globe-ui.test.mjs` cover private-field exclusions. |
| LIVEGLOBE-06 | Complete | `GET /api/public/feed-globe` and stream endpoint are unauthenticated, while publishing remains `defineAuthenticatedHandler`; tests cover guest reads and owner-scoped publishing. |

## Verification Commands

| Command | Result |
|---------|--------|
| `node scripts/run-node-tests.mjs tests/server/feed-globe-public.test.mjs tests/server/feed-publish-public-photo.test.mjs tests/server/feed-globe-density.test.mjs tests/server/feed-globe-ui.test.mjs tests/server/feed-globe-live.test.mjs tests/server/api-docs.test.mjs` | Passed, 27/27. |
| `npx eslint components/feed/feed-globe.client.vue components/feed/post-card.vue composables/use-feed-globe.ts lib/feed/globe-density.ts lib/db/queries/post.ts lib/api-docs/openapi.ts pages/feed.vue server/api/posts/index.post.ts server/api/posts/my-images.get.ts server/api/public/feed-globe.get.ts server/api/public/feed-globe/stream.get.ts tests/server/feed-globe-density.test.mjs tests/server/feed-globe-live.test.mjs tests/server/feed-globe-public.test.mjs tests/server/feed-globe-ui.test.mjs tests/server/feed-publish-public-photo.test.mjs tests/server/api-docs.test.mjs` | Passed with 0 errors; existing lint config warns that `server/api/public/**` files are ignored. |
| Targeted changed-source secret scan | Passed for real secrets; only false positives were public runtime config property names `mapboxToken`/`accessToken`. |
| HTTP smoke `http://127.0.0.1:3001/feed` | Passed, returned 200 and included `Лента`, `Глобус`, and `__NUXT__`. |
| `npm run lint:source` | Failed on unrelated existing/generated formatting issues outside Phase 12 source. |
| `npm run typecheck` | Failed on unrelated existing project type errors. |
| `npm run build` | Timed out twice, after ~184s and ~304s; lingering build processes were stopped. |

## Release Blockers

- `npm run lint:source` still fails outside Phase 12 source on `.codex/ux-screenshots/**` missing final newlines and `tests/load/README.md` prettier table formatting.
- `npm run typecheck` still fails on existing non-Phase-12 issues: `components/animated-list.vue`, `components/app/yndx-map.client.vue`, missing `vue-easy-lightbox` types, file upload typing, existing Zod/Drizzle typing, dashboard image page `never` typing, and `server/api/sentry-example-api.ts`.
- `npm run build` timed out twice, matching prior release-readiness blockers.
- Manual browser verification remains pending for real Mapbox rendering, popup click behavior, dense overflow visuals, authenticated quick publish, guest visibility, and live/polling arrivals.

## Final Assessment

Focused implementation, API, UI-source, live-update, OpenAPI, and privacy tests pass. Remaining blockers are pre-existing project-wide release gates or manual visual verification items, not known failures in the Phase 12 live feed globe implementation.

