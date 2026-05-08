# Codebase Concerns

**Analysis Date:** 2026-05-08

## Tech Debt

**AI/PWA architecture exists as diagrams but not source:**
- Issue: C4 and sequence diagrams describe AI chat, SSE streaming, AI tables, service worker, offline mode, and push notifications, but these are not implemented in current source.
- Files: `c4_diagram.puml`, `c4_architecture.dot`, `Рис5_Последовательность_AI.puml`, `Рис6_PWA_ServiceWorker.puml`.
- Impact: Planning from diagrams alone can create false assumptions about available endpoints and database tables.
- Fix approach: Add explicit "planned" status to docs or implement source slices under `server/api/ai/**`, `lib/db/schema/ai*.ts`, and PWA configuration.

**No automated tests:**
- Issue: No configured test runner, test files, or coverage command.
- Files: `package.json`, `.github/workflows/lint.yaml`.
- Impact: Refactors of auth, DB queries, upload flow, and feed interactions are regression-prone.
- Fix approach: Introduce a Nuxt-compatible test setup and start with endpoint/query tests for critical flows.

**Runtime code contains direct console logging:**
- Issue: `console.log` and `console.error` are present in handlers/stores despite `no-console` warning.
- Files: `utils/create-s3-client.ts`, `server/api/search-locations.get.ts`, `server/api/locations/[slug]/[id]/sign-images.post.ts`, `stores/map.ts`, `stores/location.ts`, `pages/dashboard.vue`.
- Impact: Logs can leak operational details and create noisy production output.
- Fix approach: Remove debug logs or route sanitized server logs through a logging/Sentry helper.

**Encoding/mojibake in user-facing Russian text:**
- Issue: Some Russian messages render as mojibake in source output.
- Files: `server/api/locations.post.ts`, `server/api/locations/[slug]/add.post.ts`, `lib/db/schema/location-log.ts`, `stores/feed.ts`.
- Impact: User-facing validation and error messages may display incorrectly.
- Fix approach: Normalize files to UTF-8 and verify rendered UI/API responses.

**Explore route generator is mocked/local:**
- Issue: `composables/useRouteGenerator.ts` returns hard-coded Tokyo/Paris/fallback routes after a timeout.
- Files: `composables/useRouteGenerator.ts`, `pages/explore.vue`.
- Impact: The Explore/AI experience is not connected to real search, route planning, or LLM APIs.
- Fix approach: Treat it as a prototype until API-backed route generation exists.

## Known Bugs

**Potential missing authorization on post publishing image ownership:**
- Symptoms: `server/api/posts/index.post.ts` accepts `locationLogImageId` and calls `createPost` without first verifying the image belongs to `event.context.user.id`.
- Files: `server/api/posts/index.post.ts`, `lib/db/queries/post.ts`.
- Trigger: Authenticated user submits another user's image id.
- Workaround: Database foreign keys ensure the image exists, but not ownership.
- Fix approach: Query `locationLogImage` by `id` and `userId` before publishing.

**Potential query injection/encoding issue in Nominatim URL construction:**
- Symptoms: Query `q` is interpolated directly into the URL string.
- Files: `server/api/search-locations.get.ts`.
- Trigger: Search terms containing reserved URL characters.
- Workaround: Zod validates shape, but URL encoding is still needed.
- Fix approach: Use `URL` and `URLSearchParams` or `encodeURIComponent(q)`.

**S3 object delete is not transactional with DB delete:**
- Symptoms: DB image metadata is deleted before S3 object deletion is attempted.
- Files: `server/api/locations/[slug]/[id]/images/[image-id].delete.ts`.
- Trigger: S3 delete fails after DB row deletion.
- Workaround: Handler catches S3 errors and logs, but metadata is already gone.
- Fix approach: Delete object first or add compensating cleanup/retry strategy.

## Security Considerations

**Environment secrets are strongly coupled to imports:**
- Risk: Any server import of `lib/env.ts` parses all required variables, which can fail or expose config requirements in unexpected contexts.
- Files: `lib/env.ts`, `lib/db/index.ts`, `utils/create-s3-client.ts`.
- Current mitigation: Zod schema centralizes required env names.
- Recommendations: Keep `.env` out of generated docs and only expose safe public vars through `runtimeConfig.public`.

**S3 upload metadata checks depend on client-supplied fields:**
- Risk: Presigned fields include user/log metadata, but upload completion trusts later metadata insert.
- Files: `server/api/locations/[slug]/[id]/sign-images.post.ts`, `server/api/locations/[slug]/[id]/image.post.ts`.
- Current mitigation: Key format includes `userId/logId/uuid.jpg`; insert schema validates numeric key layout in `lib/db/schema/location-log-image.ts`.
- Recommendations: On metadata insert, verify key prefix equals `event.context.user.id` and route id before recording.

**Public feed exposes posts to unauthenticated users with optional user-like state:**
- Risk: Feed endpoint is public by design or omission; it reads `event.context.user?.id` but does not require auth.
- Files: `server/api/feed.get.ts`.
- Current mitigation: No mutation occurs.
- Recommendations: Decide whether feed is intentionally public and document that contract.

## Performance Bottlenecks

**Feed count subqueries per row:**
- Problem: Feed query computes likes/comments counts with correlated subqueries for each post.
- Files: `lib/db/queries/post.ts`.
- Cause: SQL subselects inside the select list.
- Improvement path: Add aggregate joins or materialized counters if feed volume grows.

**Dashboard map bounds recompute on every reactive effect:**
- Problem: `stores/map.ts` recalculates bounds when map points change; large point sets may make UI updates expensive.
- Files: `stores/map.ts`, `stores/location.ts`.
- Cause: Reactive effect reduces all points and calls `fitBounds`.
- Improvement path: Debounce fit operations or compute only when point ids/coordinates change.

**Nominatim cache key is raw query string:**
- Problem: Query variants with spacing/case differences generate separate cache entries.
- Files: `server/api/search-locations.get.ts`.
- Cause: `getKey` returns `query.q?.toString() || ""`.
- Improvement path: Trim and normalize query before cache key and request URL.

## Fragile Areas

**Auth context propagation:**
- Files: `server/middleware/auth.ts`, `utils/define-authenticated-handler.ts`.
- Why fragile: Authenticated handlers assume middleware has run and set `event.context.user`.
- Safe modification: Keep middleware global and preserve `UserWithId` shape.
- Test coverage: None.

**Map provider abstraction:**
- Files: `lib/map/map-adapter.types.ts`, `lib/map/maplibre-adapter.ts`, `lib/map/yndxmap-adapter.ts`, `stores/map.ts`.
- Why fragile: Interface uses `any` for provider-specific map/location objects, and Yandex/MapLibre bounds are bridged through `_bounds`.
- Safe modification: Add tests or a typed fake adapter before refactoring store behavior.
- Test coverage: None.

**Module-level Mapbox singleton:**
- Files: `composables/useMapbox.ts`.
- Why fragile: Multiple components share mutable refs, timers, active markers, and map instance.
- Safe modification: Ensure lifecycle cleanup through `destroy()` before remounting or adding additional maps.
- Test coverage: None.

## Scaling Limits

**Database:**
- Current capacity: Turso SQLite/libSQL with Drizzle.
- Limit: Large social feed queries and count subqueries may need indexes/aggregation review.
- Scaling path: Add indexes based on feed/comment access patterns and consider cached counters.

**Image uploads:**
- Current capacity: 10 MB max per image in `server/api/locations/[slug]/[id]/sign-images.post.ts`.
- Limit: Client-side image processing and direct S3 upload are browser-dependent.
- Scaling path: Add server-side validation, async image processing, and retry/cleanup for failed metadata inserts.

**Search:**
- Current capacity: 24-hour Nitro cache per raw query.
- Limit: No rate limiting or retry/backoff around Nominatim.
- Scaling path: Normalize cache keys, add request throttling, and handle provider rate-limit responses explicitly.

## Dependencies at Risk

**Map stack overlap:**
- Risk: The project uses MapLibre, Mapbox GL, and Yandex Maps at the same time.
- Impact: Bundle size, duplicated abstractions, and maintenance complexity.
- Migration plan: Keep `lib/map/**` as the dashboard abstraction and choose one route/prototype provider before expanding map features.

**No PWA module despite PWA diagrams:**
- Risk: Workbox/service worker expectations are not backed by Nuxt config or source files.
- Impact: Offline/push requirements cannot be satisfied by current app.
- Migration plan: Add an explicit PWA module/service worker implementation or remove those claims from current-state docs.

## Missing Critical Features

**AI assistant implementation:**
- Problem: No `/api/ai/chat`, no LLM client, no AI conversation/message schema.
- Blocks: Streaming chat, route recommendations from LLM, RAG/history persistence.

**Regression test suite:**
- Problem: No unit/integration/e2e test foundation.
- Blocks: Safe refactoring of auth, storage, query, and map flows.

**Build/typecheck in CI:**
- Problem: CI only runs lint.
- Blocks: Catching Nuxt build and TypeScript regressions before merge.

## Test Coverage Gaps

**Authenticated API ownership:**
- What's not tested: Location CRUD, image upload metadata, post publishing ownership.
- Files: `server/api/locations**`, `server/api/posts/index.post.ts`.
- Risk: Cross-user data access bugs.
- Priority: High.

**Storage flow:**
- What's not tested: Presigned POST constraints, checksum handling, metadata insert, S3 delete failure behavior.
- Files: `server/api/locations/[slug]/[id]/sign-images.post.ts`, `server/api/locations/[slug]/[id]/image.post.ts`, `server/api/locations/[slug]/[id]/images/[image-id].delete.ts`.
- Risk: Orphaned objects, invalid metadata, broken uploads.
- Priority: High.

**Feed interactions:**
- What's not tested: Pagination, optimistic like rollback, comments/replies.
- Files: `stores/feed.ts`, `server/api/feed.get.ts`, `server/api/posts/[id]/**`.
- Risk: Incorrect counts or stale UI state.
- Priority: Medium.

**Map behavior:**
- What's not tested: Adapter contract, bounds fitting, fly-to behavior, Mapbox route rendering.
- Files: `stores/map.ts`, `lib/map/**`, `composables/useMapbox.ts`.
- Risk: Map UI regressions are only caught manually.
- Priority: Medium.

---

*Concerns audit: 2026-05-08*
