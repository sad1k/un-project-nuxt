---
phase: 03-ai-route-generation-and-streaming
plan: 02
subsystem: ai, api, streaming
tags: [openai-compatible, responses-api, sse, nuxt-server, route-context]
requires:
  - phase: 03-ai-route-generation-and-streaming
    provides: Plan 01 route event contract and persistence helpers
provides:
  - Server-only OpenAI-compatible streaming client
  - Bounded selected-context summarizer for route generation
  - Route-generation prompt contract for app route events
  - Authenticated AI route streaming endpoint
  - Focused stream/context tests without provider credentials
affects: [phase-03-client-route-history, phase-04-map-route-rendering]
tech-stack:
  added: []
  patterns:
    - Native fetch provider adapter under lib/ai
    - Authenticated Nuxt server endpoint returning text/event-stream
    - Server-side selected context re-read before AI prompt construction
key-files:
  created:
    - lib/ai/openai-compatible.ts
    - lib/ai/route-context.ts
    - lib/ai/route-prompts.ts
    - server/api/ai/route.post.ts
    - tests/server/ai-route-context.test.mjs
    - tests/server/ai-route-stream.test.mjs
  modified:
    - lib/env.ts
key-decisions:
  - "OPENAI_API_KEY remains server-only and optional at env-parse time so tests and local boot do not require provider credentials."
  - "The provider is prompted to emit newline-delimited app route events, and the endpoint enriches them with server session/variant ids."
  - "Selected saved places, diary logs, and candidate places are capped and truncated before provider input."
patterns-established:
  - "Provider chunks are normalized into app route events before client emission."
  - "Follow-up route requests create a new route variant under the same session."
requirements-completed:
  - AIROUTE-01
  - AIROUTE-02
  - AIROUTE-03
  - AIROUTE-05
  - AIROUTE-06
duration: 9min
completed: 2026-05-10
---

# Phase 3 Plan 2: AI Route Streaming Endpoint Summary

**Authenticated OpenAI-compatible route streaming endpoint with bounded selected-context prompting**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-10T19:08:21+03:00
- **Completed:** 2026-05-10T19:17:38+03:00
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- Added a server-only OpenAI-compatible `/responses` streaming adapter using native `fetch`.
- Added prompt instructions that explicitly preserve map-first route events and state: `raw JSON is not user-facing UI`.
- Added a selected-context summarizer that re-reads user-owned Explore context, filters explicit selections, caps records, and truncates descriptions.
- Added `server/api/ai/route.post.ts`, an authenticated SSE endpoint that validates requests/events and persists route sessions, variants, points, and events.
- Added focused stream/context tests that do not call provider APIs or require credentials.

## Task Commits

1. **Tasks 1-4: Provider client, prompt/context, endpoint, and tests** - `d31b221` (`feat`)

**Plan metadata:** pending in docs commit

## Files Created/Modified

- `lib/ai/openai-compatible.ts` - Native fetch client and SSE parser for OpenAI-compatible streaming.
- `lib/ai/route-context.ts` - Server-side selected context summary builder.
- `lib/ai/route-prompts.ts` - Locked route-generation prompt instructions and provider input assembly.
- `server/api/ai/route.post.ts` - Authenticated route-generation event stream endpoint.
- `lib/env.ts` - Adds server-only OpenAI route configuration names.
- `tests/server/ai-route-stream.test.mjs` - Source tests for provider adapter and endpoint guardrails.
- `tests/server/ai-route-context.test.mjs` - Source tests for selected context and prompt requirements.

## Decisions Made

- Made `OPENAI_API_KEY` optional in env parsing and fail at route-generation time with a sanitized failed event. This keeps non-AI tests and local app startup independent from provider credentials.
- Used SSE `data:` payloads containing app-owned route events, so the client can animate route points without showing raw provider JSON.
- Endpoint creates a fresh route variant for follow-ups rather than mutating the prior variant.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

None during source execution. Real provider behavior remains credential-dependent and was not invoked by tests.

## Verification

- PASS: `node scripts/run-node-tests.mjs tests/server/ai-route-stream.test.mjs tests/server/ai-route-context.test.mjs`
- PASS: `pnpm exec eslint lib/ai/openai-compatible.ts lib/ai/route-context.ts lib/ai/route-prompts.ts server/api/ai/route.post.ts lib/env.ts tests/server/ai-route-stream.test.mjs tests/server/ai-route-context.test.mjs --no-warn-ignored`
- PASS: LSP diagnostics on new AI/provider/endpoint files
- PASS: `rg --fixed-strings "defineAuthenticatedHandler" server/api/ai/route.post.ts`
- PASS: `rg --fixed-strings "raw JSON is not user-facing UI" lib/ai/route-prompts.ts`

## User Setup Required

Real provider calls require server-only `OPENAI_API_KEY` and `OPENAI_ROUTE_MODEL` configuration. Tests do not require these credentials.

## Next Phase Readiness

Ready for Plan 03-03 client integration: the client can consume `/api/ai/route` as an SSE stream and render history/variants from validated route events.

---
*Phase: 03-ai-route-generation-and-streaming*
*Completed: 2026-05-10*
