# Phase 13: E2E Load and Performance Verification - Context

**Gathered:** 2026-05-23T07:54:02+03:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 delivers a local-database e2e load and performance verification harness for the completed photo, place, post, and feed surfaces. It must simulate 100 synthetic users creating 1000 photos and 1000 feed posts over 10 minutes, while also creating custom places and issuing normal feed/public read traffic. The phase is about measuring and reporting real request timing and performance health, not about adding new product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Load Target and Scope
- **D-01:** The load target is local DB only. The harness must be designed for a local WanderLog deployment, not production traffic.
- **D-02:** The target profile is 100 users, 1000 photos, and 1000 posts over a 10-minute run.
- **D-03:** The scenario must include photo uploads, feed post publishing, custom place creation, ordinary feed reads, public photo reads, and feed globe/public read paths.

### Performance Metrics
- **D-04:** The primary output is measured request timing and performance metrics, not just a pass/fail smoke result.
- **D-05:** Reports must include per-step p50, p95, p99, requests per second, status-code counts, error counts, timeout counts, and sample error summaries.
- **D-06:** The practical local baseline thresholds are: read p95 <= 800ms, write p95 <= 1500ms, error rate <= 1%, and timeout rate <= 0.5%.
- **D-07:** Thresholds should be enforceable by the runner so the load run can fail when the local baseline is exceeded.

### Photo Upload Path
- **D-08:** Photo load must exercise the full S3-compatible upload flow: request signed upload target, upload image bytes to configured storage, then record image metadata in the app.
- **D-09:** Storage-heavy behavior must be explicit and documented because the DB is local but the configured S3-compatible storage may still be a real external service.
- **D-10:** Test images should be synthetic and small enough for repeatable local load while still following the app's real upload contracts.

### Synthetic Users and Auth
- **D-11:** Create 100 synthetic users directly in the local DB rather than using OAuth or a single shared session.
- **D-12:** Seeded users must have load-test-owned sessions/cookies or equivalent auth material that the runner can rotate across virtual users.
- **D-13:** The harness should preserve user ownership boundaries by distributing photos, places, posts, and reads across many synthetic owners.

### Data Retention and Cleanup
- **D-14:** Load-test data should remain after the run for diagnostics instead of being automatically removed.
- **D-15:** Every seeded user, custom place, photo object, image record, and post must be associated with a run id or deterministic load-test marker.
- **D-16:** Cleanup must be an explicit separate command by run id, including local DB cleanup and best-effort S3 object cleanup when storage objects were created.

### Load Mix
- **D-17:** Use a balanced social/photo mix for the initial 10-minute profile: about 40% feed reads, 25% photo uploads, 20% post publishes, 10% custom place creates, and 5% public/globe reads.
- **D-18:** Planner may adjust exact scheduling mechanics if needed to hit the fixed totals of 1000 photos and 1000 posts, but should preserve the balanced intent.

### the agent's Discretion
- Planner can choose whether to extend the existing Node native-fetch runner or split seed/run/report/cleanup into multiple scripts, as long as no new dependency is added casually.
- Planner can choose the exact report file format, but it should be machine-readable enough for later comparison and human-readable enough for release review.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Load Harness
- `tests/load/run-load.mjs` - Existing dependency-free load runner with read-only/auth scenarios, thresholds, p95 reporting, and JSON output.
- `tests/load/README.md` - Current load-test usage, environment variables, safety notes, and scenario documentation.
- `package.json` - Existing load scripts and dependency policy.

### App Surfaces Under Load
- `server/api/locations/[slug]/[id]/sign-images.post.ts` - Signed S3-compatible upload target endpoint used by the real image flow.
- `server/api/locations/[slug]/[id]/image.post.ts` - Image metadata attach endpoint after upload.
- `server/api/place-photos/create-private.post.ts` - Private traveler place photo creation path from Phase 10.
- `server/api/posts/index.post.ts` - Feed publishing endpoint for public uploaded diary images.
- `server/api/feed.get.ts` - Normal feed read endpoint.
- `server/api/public/place-photos.get.ts` - Public place photo read endpoint.
- `server/api/public/feed-globe.get.ts` - Public feed globe read endpoint.
- `server/api/public/feed-globe/stream.get.ts` - Live/near-live public feed globe stream endpoint.
- `lib/db/queries/post.ts` - Feed publish/read query logic and eligibility checks.
- `lib/db/queries/location.ts` - Location, diary log, and image query patterns.
- `lib/db/schema/` - Drizzle schema for users, sessions, locations, logs, images, posts, and related ownership fields.

### Planning and Verification Context
- `.planning/PROJECT.md` - Current project context, constraints, and decisions for photo sharing, feed, real media, and globe work.
- `.planning/REQUIREMENTS.md` - Existing PHOTO, REALPHOTO, and LIVEGLOBE requirements that this phase stress-tests.
- `.planning/ROADMAP.md` - Phase sequence and prior Phase 10-12 scope.
- `.planning/phases/10-traveler-place-photo-uploads-and-public-map-sharing/10-VERIFICATION.md` - Phase 10 verification and known blockers around traveler photo uploads.
- `.planning/phases/11-real-place-photo-provider-and-cache-pipeline/11-VERIFICATION.md` - Phase 11 verification and real-photo/cache boundaries.
- `.planning/phases/12-live-feed-globe-and-photo-post-map-layer/12-VERIFICATION.md` - Phase 12 verification, live feed globe evidence, and remaining release blockers.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/load/run-load.mjs`: Already provides a dependency-free native `fetch` runner, scenario registry, VU loop, timeout handling, p95/p99 summaries, threshold checks, and JSON output.
- `tests/load/README.md`: Already documents load safety, auth env, provider opt-ins, and local/staging target usage.
- Existing `npm run load:*` scripts: Provide a natural place to add `load:e2e` or specific seed/run/cleanup commands.
- Existing source-level `node:test` suites under `tests/server/`: Useful for guarding runner source behavior without needing a browser test dependency.

### Established Patterns
- Load tooling currently avoids new dependencies and uses Node native APIs.
- Authenticated scenarios currently depend on externally supplied auth headers; Phase 13 needs a stronger local synthetic session seeding path.
- Provider-heavy and quota-heavy scenarios are explicitly gated; full storage upload should follow the same explicit opt-in/safety style.
- Previous phase verification records project-wide lint/typecheck/build blockers separately from focused source verification.

### Integration Points
- Seed setup connects to the local Drizzle/libSQL database and Better Auth-compatible user/session tables.
- Upload load connects to signed S3 target creation, S3-compatible binary upload, and image metadata persistence.
- Publish load connects private/public photo eligibility to `/api/posts`.
- Read load connects `/api/feed`, public place photos, and feed globe list/stream endpoints.
- Cleanup connects to run-id-marked local DB rows and created S3 object keys.

</code_context>

<specifics>
## Specific Ideas

- The desired headline profile is exactly: 100 users / 1000 photos / 1000 posts / 10 minutes.
- Local DB is the intended persistence target for the load run.
- Full S3-compatible upload is preferred over a synthetic DB-only photo shortcut.
- Test data should remain after a run so the developer can inspect the local feed, photos, places, and globe data manually.
- Cleanup should be explicit and run-id based.

</specifics>

<deferred>
## Deferred Ideas

- Production or staging load testing is out of scope for this phase until separate budgets, storage limits, and environment safety rules are approved.
- Browser-based visual E2E load testing is out of scope unless planning determines a narrow manual verification step is needed after API-level load.
- New product capabilities such as moderation tooling, feed ranking changes, or storage quota UI are out of scope.

</deferred>

---

*Phase: 13-E2E Load and Performance Verification*
*Context gathered: 2026-05-23T07:54:02+03:00*
