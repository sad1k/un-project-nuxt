# Phase 9 Verification: Admin Route Generation Observability and Improvement Loop

**Verified:** 2026-05-19
**Status:** Implementation complete; release blockers remain outside Phase 9 changes.

## Decision Coverage

| Decision | Evidence | Status |
| --- | --- | --- |
| D-01 persisted admin role | `lib/db/schema/auth.ts` adds `user.role` | Covered |
| D-02 admin pages/APIs unavailable to regular users | `defineAdminHandler`; client pages check admin role for rendering | Covered |
| D-03 `user | admin` values | `UserRole` and Drizzle enum | Covered |
| D-04 admin endpoints authorize on admin role | `utils/define-admin-handler.ts` and admin API tests | Covered |
| D-05 first admin is manual | `09-01-SUMMARY.md` setup notes | Covered |
| D-06 no role-management UI | source tests assert no role-management surface | Covered |
| D-07 operational metadata plus sanitized snapshot | admin list/detail APIs and pages | Covered |
| D-08 allowed snapshot fields | detail page renders title/summary/points/coordinates/day/confidence/distance/timing/counts | Covered |
| D-09 no raw prompts/responses/headers/secrets/private JSON/raw payloads | admin API and UI source tests | Covered |
| D-10 list is metadata and sanitized request summary only | overview source test forbids inline route point fields | Covered |
| D-11 snapshot belongs on detail page | `pages/admin/route-generations/session-detail.vue` | Covered |
| D-12 detail requires intentional navigation | overview links to `/admin/route-generations/:sessionId` | Covered |
| D-13 hybrid `failureStage` + `failureCode` | `aiRouteVariant.failureStage`, resolver, admin API fields | Covered |
| D-14 use existing events/logs without large new schema | admin detail maps existing `aiRouteEvent` allowlisted fields only | Covered |
| D-15 v1 stages | Drizzle enum and resolver include all required stages | Covered |
| D-16 UI shows stage/code/retryability/explanation | overview and detail pages render all four | Covered |

## Commands

- Passed: `node scripts/run-node-tests.mjs tests/server/admin-auth.test.mjs`
- Passed: `node scripts/run-node-tests.mjs tests/server/admin-auth.test.mjs tests/server/admin-route-generation.test.mjs tests/server/admin-route-generation-ui.test.mjs`
- Passed: `node scripts/run-node-tests.mjs tests/server/admin-auth.test.mjs tests/server/admin-route-generation.test.mjs tests/server/admin-route-generation-ui.test.mjs tests/server/ai-route-status.test.mjs tests/server/release-hardening.test.mjs`
- Passed: `node scripts/run-node-tests.mjs tests/server/admin-route-generation-ui.test.mjs`
- Passed: `pnpm test:server` (132/132)
- Passed: `pnpm lint:source` with existing warnings only
- Failed: `pnpm typecheck`
- Timed out: `pnpm build` at 184s and 424s

## Typecheck Blockers

`pnpm typecheck` no longer reports Phase 9-specific type errors after fixes. It still fails on pre-existing project issues including:

- `components/animated-list.vue` slot child typing/arithmetic issues.
- Missing `vue-easy-lightbox` type declarations in `components/feed/post-card.vue` and `components/image-list.vue`.
- File upload type mismatch in `components/file-upload.vue`.
- Implicit array typing in `components/github-globe.vue`.
- `lib/ai/openai-compatible.ts` `HeadersInit` overload mismatch.
- `lib/db/schema/location.ts` and `lib/db/schema/location-log.ts` drizzle-zod/zod type constraint issues.
- Existing dashboard image/edit page `never` and nullable prop errors.
- `server/api/sentry-example-api.ts` invalid `#imports` export for `defineEventHandler`.

## Build Blocker

`pnpm build` produced no actionable error before timing out twice:

- Timeout after 184 seconds.
- Timeout after 424 seconds.

## Manual Verification Pending

Manual browser verification still needs:

1. Apply the DB schema change for `user.role` and `aiRouteVariant.failureStage`.
2. Assign a trusted test account `role = "admin"`.
3. Confirm an admin can open `/admin/route-generations`, filter sessions, and open a detail page.
4. Confirm a non-admin does not see admin navigation and receives API denial.
5. Confirm raw prompts, raw provider output, raw event payloads, and private context JSON are not visible.

## Overall Result

Phase 9 source implementation and automated privacy/auth coverage are complete. Release completion remains blocked by existing repository typecheck errors, build timeout, local schema rollout, and manual admin/non-admin browser verification.
