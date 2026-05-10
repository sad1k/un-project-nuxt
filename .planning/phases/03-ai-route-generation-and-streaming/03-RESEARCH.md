# Phase 3: AI Route Generation and Streaming - Research

**Date:** 2026-05-10
**Status:** Ready for planning

## Executive Summary

Phase 3 should implement a server-owned, map-first AI route-generation pipeline. The safest first slice is not an agent framework: it is a Nuxt/Nitro authenticated streaming endpoint, Drizzle-owned route-session persistence, Zod-validated route events, and a small client integration that can receive progressive route points without showing raw JSON. This follows the Phase 3 CONTEXT and AI-SPEC: generated routes are stored as variants, personal context is selected in the sidebar, streaming is an internal route-event contract, and Phase 4 receives map-ready route data.

## Technical Direction

### Framework and Provider

- Use a direct OpenAI-compatible Responses API integration from Nitro server code.
- Use native `fetch` first; do not add the OpenAI SDK or an orchestration framework unless implementation hits an API surface that justifies it.
- Keep provider config server-only through `lib/env.ts`: suggested keys are `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and `OPENAI_ROUTE_MODEL`.
- Keep `OPENAI_BASE_URL` optional so the implementation can stay OpenAI-compatible without building a v1 provider-management UI.
- Use low-temperature structured generation and local Zod validation as the enforcement layer.

### Streaming Shape

The streaming contract should be app-defined, not raw provider JSON:

- `route.session.created`
- `route.variant.started`
- `route.point.added`
- `route.point.updated`
- `route.variant.completed`
- `route.warning`
- `route.failed`

Each event should include `sessionId`, `variantId` when available, monotonic `sequence`, and a typed payload. The browser should consume these events to update route state; raw JSON is never rendered to the user.

### Persistence Model

Recommended Drizzle tables:

- `aiRouteSession`: user-owned planning session, request snapshot, city, status, active variant.
- `aiRouteMessage`: user/follow-up/assistant-summary messages for a session.
- `aiRouteVariant`: generated route candidate, status, parent variant/follow-up metadata.
- `aiRoutePoint`: map-ready points with coordinates, day, timing, rationale, confidence, distance, optional price metadata.
- `aiRouteEvent`: optional event log for replay/debugging, sanitized and bounded.

All reads and writes must be scoped by `userId` directly or through user-owned parents. Client-supplied ids are only selectors; server code must re-read selected saved places/logs by `event.context.user.id`.

### Context Construction

Phase 3 consumes `ExploreRequestContext` from Phase 2, but the provider payload should be server-shaped:

- Selected city and coordinates.
- Days, interests, filters.
- Explicitly selected saved place ids and diary log ids, re-fetched server-side.
- Selected candidate places.
- Optional current location only when enabled and coordinates are present.
- Compact summaries only: ids, names, coordinates, short descriptions, date/timing hints, and why the item was included.

Avoid sending images, full diary text, unselected saved places/logs, or arbitrary client-provided personal objects.

## Implementation Risks

| Risk | Mitigation |
|------|------------|
| Raw provider chunks leak into UI | Route events must be parsed and normalized server-side; client only handles allowlisted app event types. |
| Invalid structured output persists | Every event and final variant validates through Zod before persistence. Invalid events become warnings or failed variants. |
| Route history is lost on follow-up | Persist sessions and variants separately; follow-ups create a new variant or link to a parent variant. |
| Cross-user context access | Query helpers must accept `userId` and verify every selected saved place/log id belongs to that user. |
| Over-scoped personal context | Use selected ids only; cap counts and string lengths before provider prompt assembly. |
| Schema changes appear verified without DB push | Include a blocking Drizzle schema push task before verification. |
| Phase 4 cannot render output | Route point contract must include coordinates, day, timing, rationale, confidence/alternatives, distance hints, optional cost metadata. |

## Existing Patterns to Reuse

- `utils/define-authenticated-handler.ts` for authenticated route APIs.
- `lib/explore/context.ts` and `composables/use-explore-context.ts` for Phase 2 request-context types and UI state.
- `server/api/explore/context.get.ts` and `lib/db/queries/explore-context.ts` for bounded user-owned context patterns.
- `scripts/run-node-tests.mjs` and existing `tests/server/*.test.mjs` for low-dependency focused server tests.
- `lib/env.ts` for server-only env validation.
- `server/plugins/catch-unhandled.ts` and Sentry setup for sanitized unexpected-error reporting.

## Plan Shape

Use three dependent waves:

1. **Route Contract and Persistence Foundation** - Add Zod contract, Drizzle tables, ownership-safe query layer, tests, and schema push.
2. **Streaming Provider Endpoint** - Add OpenAI-compatible provider client, route prompt/context assembly, authenticated streaming endpoint, and endpoint tests.
3. **Explore Client Route Session UX** - Replace mock generation calls with route-session composable, progressive route state, route variant history, and follow-up input without taking over Phase 4 map rendering.

## Validation Architecture

### Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` |
| Config file | none |
| Quick run command | `node scripts/run-node-tests.mjs tests/server` |
| Full suite command | `pnpm verify:explore-foundation` |
| Estimated runtime | ~30-90 seconds |

### Required Automated Coverage

- Route contract tests for valid/invalid route points and event envelopes.
- Persistence/source tests that enforce user-owned query signatures and no raw `.env` access.
- Provider tests with mocked/fake SSE chunks; no real OpenAI calls in tests.
- Endpoint source/contract tests proving authenticated handler, Zod validation, server-only provider config, and no raw JSON UI.
- Client composable/source tests proving route variants, active variant switching, follow-up payloads, and `ExploreRequestContext` submission.

### Manual Validation

- Browser-level route streaming and map animation belongs mostly to Phase 4.
- Phase 3 manual check should be limited to seeing route-building progress/state and follow-up controls without raw JSON exposure.

## Sources

- OpenAI streaming responses: https://developers.openai.com/api/docs/guides/streaming-responses
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI text generation / Responses API: https://developers.openai.com/api/docs/guides/text
- Nuxt server routes documentation: https://dev.nuxt.com/docs/3.x/guide/directory-structure/server
- Local Phase 3 AI-SPEC: `.planning/phases/03-ai-route-generation-and-streaming/03-AI-SPEC.md`

## RESEARCH COMPLETE

