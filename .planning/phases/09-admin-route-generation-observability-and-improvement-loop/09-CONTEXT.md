# Phase 9: Admin Route Generation Observability and Improvement Loop - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers a production-ready admin observability surface for AI route generation. It adds role-based admin access, admin-only APIs/pages for browsing generated route sessions, sanitized route detail inspection, and a failure taxonomy that explains why route generation failed without exposing raw prompts, raw model responses, provider headers, secrets, private route context, or sensitive diary/location history.

This phase is about visibility, diagnosis, and service improvement signals. It does not add broad role-management UI, a hidden model-training pipeline, or unrestricted raw diagnostics access.

</domain>

<decisions>
## Implementation Decisions

### Admin Access Boundary
- **D-01:** Phase 9 must add admin authorization through a persisted role in the user model, not an env-only allowlist.
- **D-02:** Admin pages and admin APIs must check the persisted user role and be unavailable to regular users.
- **D-03:** The user model should add a `role` field, with at least `user | admin` values for v1.
- **D-04:** New admin routes and endpoints must authorize on `role === "admin"` or an equivalent typed role check.
- **D-05:** Assigning the first `admin` role in v1 is done manually through database/manual seed workflow.
- **D-06:** Phase 9 must not add UI for managing user roles; role management belongs to a future phase if needed.

### Route Session Visibility
- **D-07:** Admin session views must expose operational metadata plus a sanitized route snapshot.
- **D-08:** The sanitized route snapshot may include route title, summary, generated point names, coordinates, day/sequence, confidence, approximate distance, timing fields, and count fields.
- **D-09:** Even for admins, the app must not expose raw prompts, raw model responses, provider headers, secrets, private diary/location context JSON, or raw event payloads.
- **D-10:** The admin list view should show operational metadata and a sanitized request summary, but not expand route contents inline.
- **D-11:** The sanitized route snapshot belongs on a session detail page.
- **D-12:** Detail view should require an intentional navigation/open action so route contents are not scattered across the overview screen.

### Failure Taxonomy
- **D-13:** Phase 9 should use a hybrid failure taxonomy: normalized `failureStage` plus `failureCode` on the route variant/session summary.
- **D-14:** Existing `aiRouteEvent` rows and sanitized logs may be used as a timeline where available, but Phase 9 should not introduce a large new diagnostic event schema unless planning proves it is necessary.
- **D-15:** V1 failure stages should include `validation`, `provider`, `parsing`, `persistence`, `diary_save`, `notification`, and `unknown`.
- **D-16:** Admin UI should show failure stage, code, retryability, and a short safe explanation.

### the agent's Discretion
- The planner may choose the exact admin URL structure, component split, and query shapes as long as the role boundary, privacy constraints, and list/detail split above are preserved.
- The planner may decide whether `failureStage` is stored directly on `aiRouteVariant`, derived from existing event/failure data, or introduced through a small companion structure, provided the result is queryable for admin filters and covered by tests.
- The planner may choose the exact visual layout for the admin dashboard, but it should be operational, dense, and scannable rather than a marketing-style page.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product And Phase Scope
- `.planning/PROJECT.md` - Product direction, Explore MVP flow, privacy constraints, and current AI route/PWA state.
- `.planning/ROADMAP.md` - Phase 9 goal, success criteria, and cross-cutting constraints.
- `.planning/STATE.md` - Current GSD phase state and next-step pointer.

### Prior Route Generation Decisions
- `.planning/phases/03-ai-route-generation-and-streaming/03-CONTEXT.md` - AI route generation and streaming decisions.
- `.planning/phases/05.1-route-generation-continuity-and-completion-notifications/05.1-CONTEXT.md` - Durable route generation, route history, status, completion/failure recovery, and notification boundaries.
- `.planning/phases/06-save-to-diary-and-release-hardening/06-CONTEXT.md` - Automatic diary persistence, sanitized observability, credential exposure, ownership, and release-hardening decisions.
- `.planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-CONTEXT.md` - Provider credential and privacy constraints for route-scoped generated content.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - Nuxt/Nitro, Drizzle query layer, authenticated handler, and AI route architecture update.
- `.planning/codebase/INTEGRATIONS.md` - External provider, Sentry, server-only env, and AI route provider integration notes.
- `.planning/codebase/TESTING.md` - Existing focused `node:test` source-test pattern and verification commands.

### Source Integration Points
- `lib/db/schema/auth.ts` - Existing Better Auth user table definition where a persisted role field likely belongs.
- `lib/db/schema/ai-route.ts` - Existing route session, variant, point, and event tables.
- `lib/db/queries/ai-route.ts` - Existing user-owned route query and status/failure persistence functions.
- `server/api/ai/route-sessions.get.ts` - Existing authenticated user route-session summary endpoint.
- `server/api/ai/route/[session-id].get.ts` - Existing user-owned route session restore/detail endpoint and sanitized route snapshot shape.
- `lib/ai/route-generation-runner.ts` - Existing route generation lifecycle, failure marking, event persistence, and safe logging calls.
- `lib/ai/openai-compatible.ts` - Provider error normalization and provider diagnostics source.
- `utils/define-authenticated-handler.ts` - Existing API auth wrapper pattern.
- `utils/safe-observability.ts` - Existing sanitized logging helper and redaction policy.
- `components/app/nav-bar.vue` - Existing app navigation surface where admin entry visibility may be added if appropriate.
- `layouts/default.vue` - Existing authenticated shell layout and app-wide structure.
- `tests/server/ai-route-status.test.mjs` - Existing route status/source test patterns.
- `tests/server/release-hardening.test.mjs` - Existing safe observability and privacy hardening test pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `defineAuthenticatedHandler`: Reuse for admin-only endpoints, extending or wrapping it with a role check instead of duplicating auth plumbing.
- `aiRouteSession`, `aiRouteVariant`, `aiRoutePoint`, and `aiRouteEvent`: Existing persisted route-generation data already supports most admin list/detail needs.
- `findAiRouteSessionSummariesByUserId` and `findAiRouteSessionByIdForUser`: Useful patterns for safe summary/detail serialization, but admin queries need broader visibility with explicit admin authorization.
- `logSafeServerEvent` and `sanitizeProviderError`: Existing safe observability and failure-code normalization should be preserved and extended rather than bypassed.

### Established Patterns
- Server handlers are thin Nitro files that authenticate, validate, and delegate to `lib/db/queries/**`.
- Data access and ownership checks live in Drizzle query helpers; admin queries should still be centralized in query helpers.
- Focused `node:test` source tests assert privacy, auth, route status, and provider behavior without adding a new heavyweight test dependency.
- UI should reuse existing Nuxt pages/components and app shell conventions instead of introducing a separate admin framework.

### Integration Points
- Add persisted user `role` support through the auth schema/query path and auth/session surface used by server middleware.
- Add admin-only route-generation list/detail APIs under an explicit admin namespace, such as `server/api/admin/**`, with role checks before any broad data read.
- Add an admin page under a clear protected route, such as `pages/admin/route-generations.vue` and a session detail view.
- Extend route failure persistence/serialization so admin filters can use normalized `failureStage`, `failureCode`, retryability, timing, provider/model, and safe explanation.
- Keep user-facing `/api/ai/route-sessions` scoped to the authenticated user; do not weaken existing user ownership for normal app routes.

</code_context>

<specifics>
## Specific Ideas

- The admin overview should prioritize filtering by status, failure stage, failure code, provider/model, date/time, stale state, retry count, and route-generation stage.
- The list should be metadata-first: session id, user-safe identifier, city, days/interests summary, provider/model, status, failure stage/code, timings, point count, retry count, diary save status, and notification status.
- The detail view may show the generated route snapshot, including title/summary/points/coordinates, but must still avoid raw prompts and raw provider output.
- Failure explanations should be written for service operators: short, safe, and actionable.

</specifics>

<deferred>
## Deferred Ideas

- Admin UI for managing roles is out of scope for Phase 9.
- Raw diagnostics for admins are out of scope and conflict with the privacy constraints.
- Large-scale diagnostic event schema, model-training pipeline, and automated prompt-improvement workflow are out of scope unless a future phase explicitly adds them.
- Admin actions such as retrying failed generations, exporting diagnostics, or filing improvement issues were intentionally not discussed in this pass and can be scoped later.

</deferred>

---

*Phase: 9-Admin Route Generation Observability and Improvement Loop*
*Context gathered: 2026-05-19*
