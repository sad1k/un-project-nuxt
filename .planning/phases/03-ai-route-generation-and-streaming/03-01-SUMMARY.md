---
phase: 03-ai-route-generation-and-streaming
plan: 01
subsystem: ai, database, testing
tags: [zod, drizzle, ai-route, node-test, route-history]
requires:
  - phase: 02-explore-inputs-and-context-layer
    provides: typed Explore request context and explicit sidebar context selection
provides:
  - Validated internal route event and route point contract
  - User-owned AI route sessions, messages, variants, points, and event schema
  - Ownership-safe route persistence and history query helpers
  - Focused tests for route contract and persistence boundaries
affects: [phase-03-ai-streaming, phase-04-map-route-rendering, phase-05-place-enrichment]
tech-stack:
  added: []
  patterns:
    - Zod validation before route event persistence
    - UserId-scoped Drizzle query helpers for generated route history
key-files:
  created:
    - lib/ai/route-contract.ts
    - lib/db/schema/ai-route.ts
    - lib/db/queries/ai-route.ts
    - tests/server/ai-route-contract.test.mjs
    - tests/server/ai-route-persistence.test.mjs
  modified:
    - lib/db/schema/index.ts
key-decisions:
  - "Route variants are first-class persisted records so follow-up generations can preserve history."
  - "Cost remains optional and must carry confidence/source metadata when present."
  - "Provider output is internal data until RouteEventEnvelopeSchema validates it."
patterns-established:
  - "RouteEventEnvelopeSchema is the allowlist for server-to-client route streaming."
  - "AI route tables carry userId directly for simple ownership filters."
requirements-completed:
  - AIROUTE-05
  - AIROUTE-06
duration: 36min
completed: 2026-05-10
---

# Phase 3 Plan 1: Route Contract and Persistence Foundation Summary

**Validated route-event contract with user-owned generated-route history and focused ownership tests**

## Performance

- **Duration:** 36 min
- **Started:** 2026-05-10T18:32:00+03:00
- **Completed:** 2026-05-10T19:08:21+03:00
- **Tasks:** 5
- **Files modified:** 6

## Accomplishments

- Added `RouteGenerationRequestSchema`, `RoutePointSchema`, and `RouteEventEnvelopeSchema` for map-ready internal route events.
- Added Drizzle tables for sessions, messages, variants, route points, and event logs, with direct `userId` ownership columns.
- Added persistence helpers that set `userId` server-side and filter route-history reads by the authenticated user.
- Added focused node tests covering route contract shape, cost metadata guardrails, and persistence source safety.

## Task Commits

Each task was committed atomically enough for the current single-executor run:

1. **Tasks 1-4: Contract, schema, helpers, and tests** - `0c75b2b` (`feat`)
2. **Task 5: Drizzle schema push check** - verified locally; remote blocker documented below

**Plan metadata:** pending in docs commit

## Files Created/Modified

- `lib/ai/route-contract.ts` - Zod schemas and types for route requests, points, events, warnings, and helpers.
- `lib/db/schema/ai-route.ts` - Drizzle schema for generated route history and event persistence.
- `lib/db/schema/index.ts` - Exports the new AI route schema.
- `lib/db/queries/ai-route.ts` - User-owned route session, variant, point, event, and history helpers.
- `tests/server/ai-route-contract.test.mjs` - Source-level contract tests for route-event validation requirements.
- `tests/server/ai-route-persistence.test.mjs` - Source-level persistence and ownership safety tests.

## Decisions Made

- Kept route IDs from the provider as `routePointId` while using numeric DB primary keys for persisted rows.
- Added `priceSource` alongside `priceConfidence` so cost-bearing estimates cannot look authoritative without metadata.
- Used direct `userId` columns on all five route tables to keep authenticated ownership filters straightforward.

## Deviations from Plan

None - plan executed as written. The only operational issue was an external database credential blocker documented below.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

- `pnpm exec drizzle-kit push` against configured remote Turso reached the database but returned `LibsqlError: SERVER_ERROR: Server returned HTTP status 401`; remote schema push is not verified.
- Local fallback succeeded with `TURSO_DATABASE_URL=file:local.db` and `NODE_ENV=development`, so the new schema is Drizzle-applicable against the local database.
- Drizzle also reports an existing `tsconfig.json` warning: `Expected the "paths" option to be nested inside a "compilerOptions" object`.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/ai-route-contract.test.mjs tests/server/ai-route-persistence.test.mjs`
- PASS: `pnpm exec eslint lib/ai/route-contract.ts lib/db/schema/ai-route.ts lib/db/schema/index.ts lib/db/queries/ai-route.ts tests/server/ai-route-contract.test.mjs tests/server/ai-route-persistence.test.mjs --no-warn-ignored`
- PASS: `TURSO_DATABASE_URL=file:local.db NODE_ENV=development pnpm exec drizzle-kit push`
- BLOCKED: `pnpm exec drizzle-kit push` against configured remote Turso returned HTTP 401.

## User Setup Required

Remote database credentials need attention before claiming remote schema verification. The configured Turso target rejected the schema pull/push with HTTP 401.

## Next Phase Readiness

Ready for Plan 03-02 source work. Remote schema verification remains blocked by Turso credentials and must be re-run before production use.

---
*Phase: 03-ai-route-generation-and-streaming*
*Completed: 2026-05-10*
