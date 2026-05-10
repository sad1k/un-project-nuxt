# Phase 3: AI Route Generation and Streaming - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the authenticated AI route-generation layer for Explore. It creates user-owned AI route sessions, generated-route history, follow-up refinement, progressive route streaming, bounded personal context usage, and a structured internal route contract that Phase 4 can render on the map. It consumes the typed Explore request context from Phase 2, but does not own final map animation implementation, rich place popups, weather tips, or save-to-diary release hardening.

</domain>

<decisions>
## Implementation Decisions

### Generated Route History and Follow-Ups

- **D-01:** Generated routes must be stored as a history of route variants, not only as a single latest response.
- **D-02:** During one AI route-planning session, the user should be able to switch between generated route variants if they asked to change part of the route.
- **D-03:** Follow-up questions should refine the current route session and create/update route variants in that session, especially when the user changes a preference or asks to replace a route point.
- **D-04:** Route history persistence belongs to Phase 3. Phase 2 may prepare UI/state hooks, but Phase 3 owns the persisted conversation/message/generated-route data model.

### Progressive Route Streaming

- **D-05:** Streaming is not primarily a visible chat transcript and must never expose raw JSON to the user.
- **D-06:** The server should progressively receive, validate, and emit structured route events that the UI can use to make route points appear gradually on the map.
- **D-07:** User-visible AI text should be minimal and purposeful: short place explanations, route rationale, or helpful status copy are acceptable; raw structured payloads are not part of the UI.
- **D-08:** A chat-style input is needed for follow-up refinement only, such as changing wishes, replacing a point, or asking for an adjustment. The main first-run experience should emphasize the route appearing on the map.

### Personal Context Boundary

- **D-09:** AI context is selected by the user in the Explore sidebar. Personal saved places, diary logs, candidate places, and similar context should not be silently included without the user's explicit selection.
- **D-10:** Phase 3 should consume the typed `ExploreRequestContext` shape from Phase 2, including selected city, days, interests, filters, current-location choice, selected saved places, selected diary logs, and selected candidate places.
- **D-11:** Planner/researcher should design a bounded server-side context shape for the AI provider so selected personal data is summarized and scoped, not sent as large raw diary payloads.

### Structured Route Contract

- **D-12:** The internal route contract must include coordinates for each route point.
- **D-13:** The internal route contract must include day grouping so Phase 4 can render day-by-day route views.
- **D-14:** The internal route contract must include estimated timing or duration information for route points or route legs.
- **D-15:** The internal route contract must include human-readable rationale for why places are included.
- **D-16:** The internal route contract must include confidence metadata and alternate/fallback metadata where useful.
- **D-17:** The internal route contract must include approximate distance information where it can be estimated safely.
- **D-18:** The internal route contract may include estimated price/cost when it can be calculated or sourced responsibly. Cost must remain optional and should carry source/confidence metadata rather than being fabricated.

### the agent's Discretion

- The agent/planner may choose the exact transport shape for progressive route events, as long as the user experience is map-first and raw JSON remains internal.
- The agent/planner may choose the exact database table split for sessions, messages, route variants, and route points, as long as all user-owned data is scoped by authenticated user.
- The agent/planner may choose provider integration details and parser/repair strategy, as long as provider credentials stay server-only and invalid structured output cannot corrupt persisted route history.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, AI constraints, and privacy/security expectations.
- `.planning/REQUIREMENTS.md` - Requirement IDs AIROUTE-01 through AIROUTE-06 and v1/v2 scope boundaries.
- `.planning/ROADMAP.md` - Phase 3 goal and success criteria.
- `.planning/STATE.md` - Current workflow state and resume information.
- `.planning/phases/01-explore-scope-and-verification-foundation/01-CONTEXT.md` - Locked Explore flow, AI streaming requirement, follow-up requirement, and structured route-output requirement.
- `.planning/phases/02-explore-inputs-and-context-layer/02-CONTEXT.md` - Typed Explore request context, explicit sidebar context selection, and Phase 3 handoff decisions.

### Research and Codebase Map

- `.planning/research/FEATURES.md` - AI conversation, AI data model, client AI experience, and quality/safety framing.
- `.planning/research/SUMMARY.md` - Roadmap shape and implementation warnings for AI endpoints, streaming, schema, tests, and Sentry-safe error handling.
- `.planning/codebase/STACK.md` - Current Nuxt/Nitro, Drizzle, Better Auth, Zod, Pinia, map, and verification stack.
- `.planning/codebase/ARCHITECTURE.md` - Existing client/server/data/integration layer structure and authenticated API patterns.
- `.planning/codebase/INTEGRATIONS.md` - Confirms AI is planned but not implemented; documents existing provider and environment patterns.
- `.planning/codebase/CONCERNS.md` - Warns that AI/SSE tables/endpoints are diagram-only and identifies security/testing concerns.

### Existing Explore and Server Source

- `lib/explore/context.ts` - Phase 2 typed Explore request and personal context shapes.
- `composables/use-explore-context.ts` - Client-side selected city/days/interests/context state that Phase 3 should consume through a typed boundary.
- `composables/use-route-generator.ts` - Mock route generator to replace or wrap with real AI-backed generation.
- `pages/explore.vue` - Explore route entry point and current prototype wiring.
- `components/explore/` - Explore UI/map prototype components to preserve conceptually, not exactly.
- `server/api/explore/context.get.ts` - Authenticated endpoint for user-owned Explore personal context.
- `lib/db/queries/explore-context.ts` - Existing ownership-safe context query pattern for saved places and diary logs.
- `utils/define-authenticated-handler.ts` - Existing authenticated endpoint wrapper.
- `lib/env.ts` - Safe schema reference for server-only provider configuration names; do not read `.env`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `lib/explore/context.ts`: Provides `ExploreRequestContext`, selected personal context IDs, candidate places, days, interests, filters, and current location. Phase 3 should validate/consume this shape rather than inventing an unrelated request body.
- `composables/use-explore-context.ts`: Provides the client state boundary that can submit the route-generation request and later hold active route session/variant identifiers.
- `server/api/explore/context.get.ts` and `lib/db/queries/explore-context.ts`: Show how Explore server endpoints should return bounded, user-owned saved-place and diary-log context.
- `utils/define-authenticated-handler.ts`: Should wrap AI route-generation and history endpoints.
- `composables/use-route-generator.ts`: Current mock route generator can be retired, wrapped, or used as a fallback/test fixture during Phase 3 planning.

### Established Patterns

- Authenticated server APIs use `defineAuthenticatedHandler` and rely on `event.context.user.id`.
- API inputs are validated with Zod or schema-derived validators before hitting query/provider code.
- Database access is centralized under `lib/db/queries/**`, with schema under `lib/db/schema/**`.
- Secrets and provider keys must remain server-only; `.env` must not be read or quoted in planning docs.
- Existing verification now includes `pnpm test:server` and `pnpm verify:explore-foundation`, but full lint/typecheck may still have unrelated blockers.

### Integration Points

- New AI source likely belongs under `server/api/ai/**` or `server/api/explore/**` depending on planner naming, plus `lib/db/schema/**`, `lib/db/queries/**`, and `lib/explore/**` route-contract types.
- The client Explore page should submit Phase 2 request context and receive progressive route events for map-first rendering.
- Phase 4 depends on Phase 3 emitting/persisting route points with coordinates, day grouping, timing, rationale, confidence/alternative metadata, distance hints, and optional cost.
- Sentry/logging should observe provider failures without storing prompts, provider headers, secrets, raw personal context, or sensitive route data in logs.

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants route history for generated routes and the ability to switch generated route variants within a single session.
- User clarified that progressive streaming should drive route points appearing on the map with animation; it should not mean showing JSON or a full chat transcript to the user.
- User clarified that the chat is needed only when the user changes wishes, edits route preferences, or asks a follow-up refinement.
- User wants sidebar-driven context selection for AI.
- User wants route points to include coordinates, day grouping, estimated timing, rationale, confidence/alternative metadata, distance hints, and optional price if responsible cost estimation is feasible.

</specifics>

<deferred>
## Deferred Ideas

- Final animated map transitions, marker rendering, route lines, and day selection belong to Phase 4, although Phase 3 must stream/store data in a Phase 4-ready shape.
- Rich place popup intelligence, provider-backed reviews/photos/ratings/cost/community signals, and weather tips belong to Phase 5 unless planning identifies a small prerequisite metadata field needed in the route contract.
- Save-to-diary persistence and release hardening belong to Phase 6.

</deferred>

---

*Phase: 3-AI Route Generation and Streaming*
*Context gathered: 2026-05-10*
