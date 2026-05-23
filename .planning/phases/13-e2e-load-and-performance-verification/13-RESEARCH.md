---
phase: 13-e2e-load-and-performance-verification
type: research
status: complete
researched_at: "2026-05-23T08:05:00+03:00"
---

# Phase 13 Research: E2E Load and Performance Verification

## Research Summary

Phase 13 should extend the existing dependency-free Node load runner instead of introducing k6, Playwright, or a new performance framework. The current `tests/load/run-load.mjs` already has the right base primitives: native `fetch`, VU loops, timeout handling, p95/p99 summaries, JSON output, scenario registry, auth headers, and opt-in gates for expensive provider paths. What is missing is a local data/control plane for multi-user write traffic: synthetic Better Auth-compatible users, per-user auth cookies, run-id-marked places/logs/images/posts, full S3-compatible upload orchestration, write/read classification, and run-id cleanup.

## Existing Assets

- `tests/load/run-load.mjs` is the best starting point. It already supports scenarios, `--vus`, `--duration`, `--timeout`, `--max-error-rate`, `--max-p95`, `--json`, `--dry-run`, and auth headers.
- `tests/load/README.md` already documents local/staging safety notes and opt-in flags for provider-heavy scenarios.
- `package.json` already has `load:*` scripts and no extra load-testing dependency.
- `lib/db/schema/auth.ts` defines Better Auth `user` and `session` tables with integer ids and string session tokens.
- `server/middleware/auth.ts` resolves auth through `auth.api.getSession({ headers: event.headers })`, so seeded sessions must be validated by the actual app, not assumed valid from DB rows alone.
- `server/api/auth/profile.get.ts` is a lightweight authenticated endpoint suitable for verifying seeded user cookies before running expensive upload traffic.
- `server/api/place-photos/create-private.post.ts` creates a location and location log for a traveler place photo.
- `server/api/locations/[slug]/[id]/sign-images.post.ts` creates presigned S3-compatible POST targets with checksum and user/log metadata conditions.
- `server/api/locations/[slug]/[id]/image.post.ts` validates the object exists in S3 and checks metadata before inserting `locationLogImage`.
- `server/api/locations/[slug]/[id]/images/[image-id]/visibility.patch.ts` makes images public with public place name and coordinates.
- `server/api/posts/index.post.ts` publishes an eligible public image to the feed and preserves duplicate conflict behavior.
- `server/api/feed.get.ts`, `server/api/public/place-photos.get.ts`, and `server/api/public/feed-globe.get.ts` cover the read paths for the balanced load mix.

## Recommended Architecture

### Keep the Runner Native

Use Node built-ins plus existing dependencies. The project already depends on `@libsql/client`, AWS S3 SDK packages, and native `fetch`/`FormData`, so Phase 13 can avoid new dependencies.

Recommended structure:

- `tests/load/run-load.mjs` remains the CLI entry point and scenario runner.
- Add small helper modules under `tests/load/lib/` for metrics, local DB seeding, synthetic auth sessions, S3 upload form handling, and e2e scenario data.
- Add `tests/load/cleanup-run.mjs` or a runner subcommand for explicit cleanup by `runId`.
- Add focused `node:test` source tests that inspect or exercise helper behavior without requiring live S3.

### Seed Users Directly, Then Verify Through the App

The user chose direct local DB seeding for 100 users. Planning should not rely only on inserting rows. The runner should:

1. Insert deterministic users with names/emails carrying a `loadRunId` marker.
2. Insert sessions with future `expiresAt`, synthetic token values, `userAgent`, and `ipAddress`.
3. Build cookie headers using Better Auth's session cookie name expected by the app, currently documented in app OpenAPI/load docs as `better-auth.session_token`.
4. Before load starts, call `/api/auth/profile` for a sample or all seeded sessions and fail early if the app does not accept the cookie.

This keeps the test honest: if Better Auth token format or cookie naming changes, the preflight fails before S3 objects are created.

### Exercise the Real Photo Path

The write flow should mirror the current user capture flow:

1. `POST /api/place-photos/create-private` with synthetic place name and coordinates.
2. Generate a small deterministic image body and SHA-256 checksum.
3. `POST {created.upload.signUrl}` with `contentLength` and checksum.
4. POST multipart form to returned S3-compatible `url` with all signed fields plus `file`.
5. `POST {created.upload.imageUrl}` with the returned key.
6. `PATCH /api/locations/{slug}/{logId}/images/{imageId}/visibility` to public using run-id place metadata.
7. `POST /api/posts` with `locationLogImageId` and a synthetic caption.

The existing metadata validation in `image.post.ts` means Phase 13 must use the signed POST path; DB-only image rows will not validate the true behavior the user asked to load test.

### Metrics and Thresholds

Current runner metrics should be extended from global p95 to per-step and per-class reporting:

- Per step: requests, failures, timeout count, status counts, bytes, p50, p95, p99, max, TTFB p95.
- Per class: read/write p95 and p99.
- Run totals: elapsed time, RPS, achieved uploads/posts, error rate, timeout rate.
- Thresholds: read p95 <= 800ms, write p95 <= 1500ms, error rate <= 1%, timeout rate <= 0.5%.

The runner should distinguish request failure, application rejection, timeout, and setup failure. A failed setup should stop before the 10-minute load window.

### Data Retention and Cleanup

The user chose to preserve data after runs for diagnostics. Therefore:

- No automatic cleanup after success or failure.
- Every created user, session, place, log, image key, and post must be traceable to `runId`.
- Cleanup must be a separate explicit command by `runId`.
- S3 cleanup should be best-effort and only delete keys matching the load-run marker or manifest.
- The runner should write a run manifest with `runId`, created users, session tokens or safe token suffixes, image keys, counts, and report path. Do not write secrets.

Because the existing schema does not have a dedicated `loadRunId`, use deterministic prefixes in safe fields: email, name, location/place names, captions, image descriptions, and S3 object key paths returned by the signed endpoint. If implementation needs stronger cleanup, planner may add a local-only manifest file rather than changing production schema.

## Risks and Constraints

- Better Auth seeded session behavior must be verified against `/api/auth/profile`; otherwise writes may fail as 401 under load.
- Nuxt CSRF may block mutating endpoints when called outside `$csrfFetch`; the runner should either obtain a valid CSRF token from the app or document and implement the correct header/cookie pairing before write traffic begins.
- Full S3-compatible upload can incur external network/storage cost even when DB is local. Keep an explicit opt-in such as `LOAD_ENABLE_STORAGE_UPLOAD=1`.
- The existing `image.post.ts` logs S3 metadata and `create-s3-client.ts` logs the endpoint. Phase 13 should not expand logging of secrets or raw tokens and may record this as a release-hardening risk if logs become noisy.
- The local SQLite/libSQL database may serialize writes more heavily than production Turso; results are a local baseline, not a production capacity claim.
- Project-wide `lint:source`, `typecheck`, and `build` have existing blockers. Phase 13 verification should run focused tests and targeted lint first, then report existing broad blockers honestly.

## Suggested Plan Shape

1. Build local load identity/run foundation: run ids, seeded users/sessions, auth preflight, manifest, cleanup skeleton, metrics classification primitives.
2. Implement the balanced e2e social/photo load scenario with full S3-compatible upload and exact 1000 photo/post targets over 10 minutes.
3. Add report artifacts, explicit cleanup, docs, scripts, source tests, and final Phase 13 verification.

## Research Complete

Phase 13 can be planned without new dependencies. The key implementation hazard is auth/CSRF preflight; the key safety hazard is full S3-compatible upload against non-local storage. Both should be first-class tasks and verification gates in the plans.
