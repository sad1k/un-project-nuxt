# Phase 9: Admin Route Generation Observability and Improvement Loop - Research

**Researched:** 2026-05-19
**Status:** Ready for planning

## Research Summary

Phase 9 should build on existing route-generation persistence rather than introduce a separate analytics store first. The current app already stores route sessions, variants, points, lifecycle timestamps, failure codes, notification state, retry count, and event payloads. The missing pieces are a persisted admin role, a role-checking API wrapper, admin-scoped read queries, normalized failure stage data, and a compact operational UI.

## Existing Architecture Findings

### Auth And Role Boundary

- `lib/db/schema/auth.ts` defines the Better Auth `user` table and exported `UserWithId` type.
- Current `user` fields are `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, and `updatedAt`; there is no role field.
- `server/middleware/auth.ts` stores `session?.user` as `event.context.user`.
- `utils/define-authenticated-handler.ts` centralizes authenticated API checks and is the right pattern to extend with an admin-only wrapper.
- There is no existing role-management surface, and Phase 9 decisions explicitly keep role assignment manual through DB/seed.

Recommended direction:
- Add `role: text().notNull().default("user")` to the `user` table.
- Extend the `UserWithId` type to include a narrow role union such as `"user" | "admin"`.
- Add a helper such as `utils/define-admin-handler.ts` or `utils/require-admin-role.ts` that wraps `defineAuthenticatedHandler` and returns 403 for non-admin users.
- Add source tests proving admin endpoints use the admin wrapper and ordinary route-session APIs remain user-scoped.

### Route Generation Persistence

- `lib/db/schema/ai-route.ts` already defines:
  - `aiRouteSession`: user-owned session, status, city, request context JSON, active variant, timestamps.
  - `aiRouteVariant`: user-owned variant, status, title, summary, failureCode, lifecycle timestamps, runner id, notification status, retry count.
  - `aiRoutePoint`: generated route point with coordinates, sequence, day, confidence, distance, price data.
  - `aiRouteEvent`: persisted route events with type, payload JSON, validation status, and sequence.
- `lib/db/queries/ai-route.ts` already serializes user-owned summaries and detail snapshots for normal users.
- Existing user-facing endpoints should not be weakened:
  - `server/api/ai/route-sessions.get.ts` must remain scoped to `event.context.user.id`.
  - `server/api/ai/route/[session-id].get.ts` must remain scoped to the current user.

Recommended direction:
- Add separate admin queries rather than broadening the normal user queries.
- Admin list query should return operational metadata, sanitized request summary, failure stage/code, provider/model, timings, point count, retry count, diary status, notification status, and safe user identifiers.
- Admin detail query should return the sanitized route snapshot and sanitized event/timeline data where available, but not raw request context JSON or raw payload JSON.

### Failure Taxonomy

- Current route failures are stored as `failureCode` on `aiRouteVariant`.
- Provider errors are normalized in `lib/ai/openai-compatible.ts` through `sanitizeProviderError`.
- `lib/ai/route-generation-runner.ts` logs lifecycle events through `logSafeServerEvent`, marks variants failed, and persists a `route.failed` event.
- Existing failure categories already include provider-oriented codes such as `provider_rate_limited`, `provider_auth_failed`, `provider_access_denied`, `provider_unavailable`, `provider_request_failed`, and `provider_returned_no_route_points`.

Recommended direction:
- Add normalized `failureStage` as either a persisted `aiRouteVariant` field or a derived value that is materialized in admin summaries.
- Prefer persisting `failureStage` if filters need to be fast and reliable.
- Use these v1 stages: `validation`, `provider`, `parsing`, `persistence`, `diary_save`, `notification`, `unknown`.
- Keep retryability and safe explanation as derived presentation data. Do not store raw error messages.
- Use existing `aiRouteEvent` rows and safe logs as optional timeline evidence where available; do not create a large new diagnostic event schema in Phase 9 unless implementation discovers a hard blocker.

### UI Surface

- The app has a dark, dense shell with `AppNavBar`, `AppSideRail`, `AppMobileToolbar`, and `AppUserMenu`.
- Existing dashboard pages use compact operational layout patterns, Tailwind/DaisyUI classes, and Tabler icons through `<Icon>`.
- Phase 9 should feel like an internal operations tool: dense tables, filters, status badges, and detail panels rather than a hero/marketing page.

Recommended direction:
- Add admin pages under an explicit route namespace, such as `pages/admin/route-generations.vue` and `pages/admin/route-generations/[session-id].vue`.
- Show admin entry points only when `authStore.user?.role === "admin"`, while still enforcing access server-side.
- Use list/detail split:
  - List: metadata and sanitized request summary only.
  - Detail: sanitized route snapshot and safe timeline/explanations.

### Testing And Verification

- Existing tests use `node:test` and source/behavior assertions through `scripts/run-node-tests.mjs`.
- Relevant existing tests:
  - `tests/server/ai-route-status.test.mjs`
  - `tests/server/ai-route-persistence.test.mjs`
  - `tests/server/release-hardening.test.mjs`
- `pnpm test:server` and `pnpm lint:source` are the standard broad checks.
- `pnpm typecheck` and `pnpm build` have known existing blockers/timeouts from prior verification and should be run or honestly recorded if still blocked.

Recommended direction:
- Add focused tests before implementation edits:
  - admin role schema and admin handler tests;
  - admin route-generation query/API privacy tests;
  - admin UI source tests for list/detail privacy and route guards.
- Verify no admin endpoint returns `requestContextJson`, `payloadJson`, raw prompts, raw model responses, provider body previews, authorization headers, or secret-bearing env names.

## Risks

- Better Auth may not automatically include newly added custom user fields in `session.user`. Implementation should verify whether the role is present in session data or needs a server-side role lookup by user id before admin authorization.
- Adding a `role` column requires schema push/migration handling for local and remote databases.
- Admin broad reads intentionally cross user ownership boundaries, so authorization must happen before any broad query.
- Route snapshots can still be sensitive; keep them out of the list page and avoid raw request/event payloads.

## Planning Recommendation

Use three dependent plans:

1. Add role-backed admin authorization foundation.
2. Add admin route-generation data model/query/API and failure taxonomy.
3. Build the admin UI and final privacy/verification coverage.

---

*Research completed: 2026-05-19*
