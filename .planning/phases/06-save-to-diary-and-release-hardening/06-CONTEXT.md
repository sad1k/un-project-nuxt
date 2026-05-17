# Phase 6: Save to Diary and Release Hardening - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 completes the Explore loop by saving completed AI-generated routes into the existing diary model and hardening the release surface. It owns generated-route-to-diary persistence, selected/generated place persistence where it fits the existing `location` and `locationLog` structures, authenticated ownership checks, sanitized observability for AI/weather/review/place provider failures, provider credential exposure audits, and release verification. It does not add a new diary product surface beyond what is needed to persist generated routes and route points.

</domain>

<decisions>
## Implementation Decisions

### Route-to-Diary Shape

- **D-01:** A saved generated route should create diary content using the existing diary structures instead of introducing a separate route-diary model first.
- **D-02:** Each generated route point should become one `locationLog` under the authenticated user.
- **D-03:** The implementation should create or reuse a matching `location` for each route point before inserting that route point's `locationLog`.
- **D-04:** The generated route should be saved as a whole route, not as an only-manual set of independent place saves.

### Automatic Save Behavior

- **D-05:** Completed generated routes should automatically save to the user's diary.
- **D-06:** Route history should remain automatic as established by Phase 5.1, and Phase 6 should connect that completed route history to automatic diary persistence rather than requiring the user to click a separate "Save to diary" action.
- **D-07:** Automatic diary save must be idempotent so reloading, restoring route history, or retrying a completion handler does not create duplicate diary logs for the same generated route points.

### Place Saving Behavior

- **D-08:** The default save unit is the whole generated route. Selected-place save affordances can exist only if they reuse the same route-point-to-location-log pathway and do not replace whole-route saving.
- **D-09:** Saved route points must remain associated with the authenticated user through both the `location` and `locationLog` records.

### Diary and History UX

- **D-10:** The route should be automatically saved to route history and diary after successful generation.
- **D-11:** The UI should make the saved state visible from the route history/completed-session surface and Explore route sidebar, so the user understands the route is already in their diary.
- **D-12:** Exact confirmation copy, saved-state badges, and navigation links to created diary records are the agent's discretion, provided users can discover the saved diary outcome without inspecting the database.

### Release Hardening

- **D-13:** Sanitized Sentry/logging is a release-blocking part of Phase 6. Provider failures may be observed, but logs/events must not include raw prompts, raw model responses, provider headers, secrets, private route context, or sensitive location history.
- **D-14:** Build and typecheck are release-blocking verification targets for Phase 6. If existing unrelated typecheck failures remain, the verification must list them explicitly with file-level blockers and distinguish them from Phase 6 regressions.
- **D-15:** Provider credentials must remain server-only unless a variable is intentionally public and safe, such as existing browser map/public notification keys.
- **D-16:** Cross-user access for route sessions, route points, created diary locations/logs, and provider-derived place data must be covered by focused tests or explicit verification.

### the agent's Discretion

- The agent/planner may choose whether automatic diary persistence runs inside the route completion path, a follow-up server action, or a recoverable reconciliation pass, as long as it is idempotent, user-owned, and observable without leaking sensitive data.
- The agent/planner may choose the exact generated `location` naming, slug collision strategy, `locationLog` timestamp mapping, and description format, provided route point identity and route/session provenance are preserved enough to avoid duplicates and support user understanding.
- The agent/planner may choose the exact Sentry helper/logging abstraction, but direct provider/raw-context logging should be removed or replaced where Phase 6 touches provider failure handling.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, privacy constraints, and current app capabilities.
- `.planning/REQUIREMENTS.md` - Requirement IDs DIARY-01 through DIARY-03 and OBS-01 through OBS-03.
- `.planning/ROADMAP.md` - Phase 6 goal and success criteria.
- `.planning/STATE.md` - Current workflow state and known verification blockers.
- `.planning/phases/04-animated-map-route-experience/04-CONTEXT.md` - Map route viewing boundaries and save-to-diary deferral.
- `.planning/phases/05-place-intelligence-and-weather-tips/05-CONTEXT.md` - Place intelligence, provider data, weather-tip, and deferred save-to-diary context.
- `.planning/phases/05.1-route-generation-continuity-and-completion-notifications/05.1-CONTEXT.md` - Durable route history, completed-session recovery, and notification state context.
- `.planning/phases/05.1-route-generation-continuity-and-completion-notifications/05.1-VERIFICATION.md` - Prior verification status, including current `pnpm test:server`, `pnpm lint:source`, and unrelated typecheck blockers.

### Codebase Maps and Research

- `.planning/codebase/STACK.md` - Nuxt, Nitro, Drizzle, Better Auth, Sentry, and verification stack.
- `.planning/codebase/ARCHITECTURE.md` - Existing authenticated API, query, data, and integration-layer patterns.
- `.planning/codebase/INTEGRATIONS.md` - Existing Sentry, provider, runtime config, and server-only credential patterns.
- `.planning/codebase/CONCERNS.md` - Direct logging, test gaps, ownership concerns, and provider secrecy risks.
- `.planning/research/SUMMARY.md` - Roadmap-wide warnings for provider integration, security, and testing.

### Route, Diary, and Observability Source

- `lib/db/schema/ai-route.ts` - Persisted user-owned route sessions, variants, points, events, and route history metadata.
- `lib/db/queries/ai-route.ts` - Ownership-safe route session, route summary, route restore, and route point lookup queries.
- `lib/db/schema/location.ts` - Existing saved-place table, slug/name uniqueness, user ownership, and insert validation.
- `lib/db/schema/location-log.ts` - Existing diary log table, timestamp/coordinate validation, and user/location ownership.
- `lib/db/queries/location.ts` - Existing ownership-safe location and location-log lookup/update/delete patterns.
- `lib/db/queries/location-log.ts` - Existing `insertLocationLog` insertion path.
- `server/api/locations/[slug]/add.post.ts` - Current authenticated diary log creation endpoint pattern.
- `composables/use-ai-route-session.ts` - Client route session generation, restore, and completed route state.
- `components/explore/route-panel.vue` - Explore route sidebar where saved diary status can be surfaced.
- `components/explore/route-history.vue` - Route history/completed-session surface that should reflect automatic save state.
- `lib/env.ts` - Safe source for environment variable names and server-only provider credential audit.
- `nuxt.config.ts` - Runtime config boundary, including public values that must be reviewed for credential exposure.
- `server/plugins/catch-unhandled.ts` - Existing sanitized unhandled-rejection handling pattern.
- `sentry.server.config.ts` - Server Sentry configuration.
- `sentry.client.config.ts` - Client Sentry configuration.
- `package.json` - Verification scripts including `test:server`, `lint:source`, `typecheck`, and `build`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `aiRouteSession`, `aiRouteVariant`, and `aiRoutePoint` already persist completed generated route data by `userId`; Phase 6 should consume these rather than treating route output as client-only state.
- `findAiRouteSessionByIdForUser`, `findAiRouteSessionsByUserId`, and `findAiRoutePointForPlaceIntelligence` show the existing ownership pattern for route data.
- `location` and `locationLog` are the existing diary persistence structures. A saved route point should map to a user-owned `locationLog` and a created/reused user-owned `location`.
- `insertLocationLog` is currently minimal and can be reused or wrapped by a route-import service.
- `defineAuthenticatedHandler` plus query-level `userId` filters are the established authenticated API pattern.
- Existing server tests under `tests/server` are source-inspection and focused behavior checks; Phase 6 should extend that style for diary import, credential exposure, logging sanitization, ownership, and release verification.

### Established Patterns

- Server handlers validate request bodies with Zod or Drizzle-generated schemas and return H3 errors for validation failures.
- Database ownership is enforced by including `userId` in Drizzle `where` clauses and insert values.
- Provider credentials are read from server-side env schema and should not appear in `runtimeConfig.public`, browser composables, or client components unless explicitly safe.
- Existing Explore provider work degrades gracefully when provider data is missing; Phase 6 hardening should preserve graceful behavior while improving observability.

### Integration Points

- Route completion from Phase 5.1 is the natural trigger for automatic diary persistence.
- Route history restore is the natural recovery path for reconciliation if automatic diary save fails or needs retry.
- Explore route sidebar and route history should surface saved-to-diary status and links to created diary entries.
- Sentry/logging hardening should focus on AI route generation, place intelligence, weather tips, route notification, and diary save failures.
- Release verification should run focused server tests first, then `pnpm lint:source`, `pnpm typecheck`, and `pnpm build`, with known unrelated blockers documented separately.

</code_context>

<specifics>
## Specific Ideas

- User wants one diary log per generated route point.
- User wants the whole generated route saved, not only a manual selected-place subset.
- User wants the generated route automatically saved to route history and automatically saved into the diary.
- User wants Phase 6 hardening to prioritize sanitized Sentry logging, build, and typecheck.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 6 scope.

</deferred>

---

*Phase: 6-Save to Diary and Release Hardening*
*Context gathered: 2026-05-18*
