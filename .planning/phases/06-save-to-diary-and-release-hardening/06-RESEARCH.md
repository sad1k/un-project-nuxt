# Phase 6 Research: Save to Diary and Release Hardening

**Phase:** 6 - Save to Diary and Release Hardening  
**Date:** 2026-05-18  
**Status:** Complete

## Phase Goal

Complete the Explore loop by automatically saving completed generated routes into the user's diary and hardening ownership, observability, provider secrecy, build, and typecheck readiness.

## Inputs Read

- `.planning/phases/06-save-to-diary-and-release-hardening/06-CONTEXT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/phases/05.1-route-generation-continuity-and-completion-notifications/05.1-VERIFICATION.md`
- `lib/db/schema/ai-route.ts`
- `lib/db/queries/ai-route.ts`
- `server/api/ai/route.post.ts`
- `lib/ai/route-generation-runner.ts`
- `server/api/ai/route-sessions.get.ts`
- `lib/db/schema/location.ts`
- `lib/db/schema/location-log.ts`
- `lib/db/queries/location.ts`
- `lib/db/queries/location-log.ts`
- `components/explore/route-history.vue`
- `components/explore/route-panel.vue`
- `lib/env.ts`
- `nuxt.config.ts`
- `server/plugins/catch-unhandled.ts`
- `package.json`
- Existing focused server tests under `tests/server`

## Current Implementation Evidence

### AI Route State

Generated routes are already persisted by user:

- `aiRouteSession` stores user-owned route sessions and the active variant id.
- `aiRouteVariant` stores terminal generation status, title, summary, lifecycle fields, and notification status.
- `aiRoutePoint` stores ordered generated route points with route point id, day, name, coordinates, rationale, confidence, distance, and price metadata.
- `findAiRouteSessionByIdForUser`, `findAiRouteSessionsByUserId`, and `findAiRouteSessionSummariesByUserId` all filter by authenticated `userId`.
- `runRouteGeneration` marks variants completed/failed and persists route points, so completion is the correct automatic diary-save trigger.

### Diary State

The existing diary model is `location` plus `locationLog`:

- `location` is user-owned and unique by `(name, userId)`.
- `locationLog` is user-owned and belongs to a `location`.
- `InsertLocationLogSchema` validates name, description, coordinates, and time ranges.
- `insertLocationLog` currently accepts a validated `InsertLocationLog`, a `locationId`, and `userId`.
- Existing query helpers consistently use `userId` in location/log lookup, update, and delete paths.

The route-to-diary import should therefore be a domain service that consumes user-owned route variants/points and writes user-owned `location` plus `locationLog` records.

### UI State

- `components/explore/route-history.vue` already lists saved route sessions and can restore completed sessions.
- `components/explore/route-panel.vue` is the visible route-session surface where saved-to-diary status can be displayed.
- `server/api/ai/route-sessions.get.ts` currently returns compact route summaries; Phase 6 can extend these summaries with diary-save status after the persistence layer exists.

### Observability and Release Gates

- `lib/ai/route-generation-runner.ts` still contains direct `console.warn` and `console.error` logging for route lifecycle and provider failures.
- Some logs include provider parsing previews such as `previewValue(rawEvent)` and `bufferedTextPreview: textBuffer.slice(0, 1000)`. These should be treated as risky for Phase 6 because context explicitly forbids raw prompts, raw model responses, provider headers, private route context, or sensitive location history in logs/events.
- `server/plugins/catch-unhandled.ts` has a small sanitizing pattern, but there is no reusable sanitized server observability helper yet.
- `nuxt.config.ts` exposes `s3BucketUrl`, `sentryDsn`, `mapboxToken`, and `routeNotificationVapidPublicKey` through `runtimeConfig.public`. Phase 6 should add an explicit source-level audit that server-only credentials such as `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `TURSO_AUTH_TOKEN`, and S3 secret keys are not exposed to browser runtime or client source.
- `package.json` has `test:server`, `lint:source`, `typecheck`, and `build`. Phase 5.1 verification recorded `pnpm test:server` and `pnpm lint:source` passing, while `pnpm typecheck` remains blocked by pre-existing unrelated type errors.

## Recommended Implementation Shape

### Plan 06-01: Diary Import Core

Build a pure, testable route-to-diary import layer.

Recommended files:

- Add `lib/db/schema/route-diary-save.ts` or equivalent metadata table if needed for idempotency.
- Export the new schema from `lib/db/schema/index.ts`.
- Add `lib/db/queries/route-diary-save.ts` or `lib/db/queries/route-diary.ts`.
- Extend `lib/db/queries/location.ts` with create-or-reuse-by-user helpers if needed.
- Integrate the import in `lib/ai/route-generation-runner.ts` after `markAiRouteVariantCompleted`.
- Add `tests/server/route-diary-save.test.mjs`.

The implementation should avoid a new diary product model unless required for idempotency. A small metadata table that maps `(userId, sessionId, variantId, routePointId)` to created `locationId` and `locationLogId` is reasonable because it prevents duplicate logs on retry and lets UI summarize save status.

### Plan 06-02: Saved-State UI

Expose automatic diary-save status to users.

Recommended files:

- Extend route summary/restore query output with diary save summary.
- Update `server/api/ai/route-sessions.get.ts` and `server/api/ai/route/[session-id].get.ts` if needed.
- Update `composables/use-ai-route-session.ts` and/or `composables/use-route-generation-status.ts`.
- Update `components/explore/route-history.vue` and `components/explore/route-panel.vue`.
- Add `tests/server/route-diary-ui.test.mjs` or source-level assertions in `route-diary-save.test.mjs`.

The UI should not require an explicit save button because the user locked automatic diary save. It should instead show "saved to diary" status and link/navigate to created diary records where practical.

### Plan 06-03: Release Hardening

Add sanitized observability and release checks.

Recommended files:

- Add a small server observability helper under `utils/` or `lib/observability/`.
- Replace risky direct logs in route generation, place intelligence, weather tips, and route notification touched paths.
- Add source-level tests for credential exposure and unsafe log payloads.
- Create `06-VERIFICATION.md` during execution with command evidence and known typecheck blockers.

Verification should include:

- `node scripts/run-node-tests.mjs tests/server/route-diary-save.test.mjs tests/server/route-diary-ui.test.mjs tests/server/release-hardening.test.mjs`
- `pnpm test:server`
- `pnpm lint:source`
- `pnpm typecheck`
- `pnpm build`
- Manual `/explore` browser check for completed route, route history, and diary saved state.

## Key Risks and Mitigations

| Risk | Why It Matters | Mitigation |
|------|----------------|------------|
| Duplicate diary logs on retry/restore | Automatic save runs without user confirmation | Add idempotency metadata keyed by user, session, variant, and route point id. |
| Cross-user diary writes | Route and diary data are user-owned | Re-read route/session by authenticated user id and write `location`/`locationLog` with the same `userId`. |
| Slug/name collisions | Route points may share names with existing places | Reuse existing user-owned locations by normalized name/coordinate when safe; otherwise generate deterministic per-user slugs. |
| Raw provider text in logs | Phase 6 forbids sensitive/provider payload logging | Replace previews with counts, safe error codes, session/variant ids, and sanitized diagnostics. |
| Typecheck remains red | Release hardening requires typecheck evidence | Run it and document existing unrelated blockers separately from Phase 6 regressions. |
| Build reveals SSR/env import issues | New import paths can parse env at build time | Run `pnpm build` as a release gate and keep provider secrets server-only. |

## Research Conclusion

Phase 6 should be planned as three dependent waves:

1. Diary import core and idempotent automatic persistence.
2. Saved-to-diary status surfaced in Explore route history/sidebar.
3. Sanitized observability, credential exposure checks, ownership tests, build/typecheck release verification, and `06-VERIFICATION.md`.

This order lets execution first establish the data contract, then connect the UI, then close release hardening with full evidence.
