# Phase 9 Plan 02 Summary: Admin APIs and Failure Taxonomy

**Status:** Complete with DB rollout pending.
**Executed:** 2026-05-19

## Changed Files

- `lib/db/schema/ai-route.ts`
- `lib/db/queries/ai-route.ts`
- `lib/ai/route-generation-runner.ts`
- `server/api/admin/route-generations.get.ts`
- `server/api/admin/route-generations/[session-id].get.ts`
- `server/api/ai/route/[session-id].get.ts`
- `tests/server/admin-route-generation.test.mjs`

## What Changed

- Added `failureStage` to `aiRouteVariant` with the v1 stage set: `validation`, `provider`, `parsing`, `persistence`, `diary_save`, `notification`, `unknown`.
- Added `resolveAiRouteFailureStage` and stored the resolved stage when route generation fails.
- Added admin query helpers for route-generation summaries and detail snapshots.
- Added admin list/detail APIs under `/api/admin/route-generations`, both protected by `defineAdminHandler`.
- Kept normal route-session restore user-scoped while adding `failureStage` to the user-owned restore snapshot.
- Added safe admin diagnostics: retryability, short explanation, diary-save status, safe event timeline fields, and sanitized request summaries.

## Privacy Boundary

- Admin APIs do not return raw `requestContextJson`, raw `payloadJson`, raw prompts, raw model responses, provider headers, secrets, or private diary/location context JSON.
- Overview data stays metadata-first; route point contents are only returned by the admin detail endpoint.

## Verification

- Passed: `node scripts/run-node-tests.mjs tests/server/admin-auth.test.mjs tests/server/admin-route-generation.test.mjs tests/server/ai-route-status.test.mjs tests/server/release-hardening.test.mjs`
- Passed: `pnpm test:server` with 132/132 tests.
- Passed: `pnpm lint:source` with existing warnings only.

## Remaining Risks

- `failureStage` column needs a schema push/migration before runtime use against an existing DB.
- Provider/model fields are currently reserved as `null` because existing persisted route-generation data does not store them per variant yet.
