# WanderLog

## What This Is

WanderLog is a Nuxt 3 travel journaling platform for authenticated travelers who want to save places, record visits, attach images, view them on maps, and share selected memories in a social feed. The existing codebase already implements the core journal, feed, auth, database, S3 image flow, maps, and Sentry integration.

The active project direction is to close the gap between the architecture diagrams and source code by adding an AI travel assistant, streaming responses, route/map suggestions, and a real PWA layer.

## Core Value

Users can turn their own travel context into useful AI-assisted route recommendations and keep the travel journal usable as a reliable web app.

## Requirements

### Validated

- Existing user can authenticate with GitHub/Google OAuth through Better Auth - existing.
- Existing user can manage travel locations and location logs - existing.
- Existing user can upload and view images through S3-compatible storage - existing.
- Existing user can view locations and logs on maps through the current map layer - existing.
- Existing user can publish image-based posts, view feed items, like posts, and comment - existing.
- Existing server validates location/log/feed inputs with Zod and Drizzle-generated schemas - existing.
- Existing app reports errors through Sentry configuration - existing.

### Active

- [ ] User can send a travel planning prompt to an authenticated AI assistant.
- [ ] User can see streamed AI response text while generation is in progress.
- [ ] User AI conversations and messages are persisted and scoped to that user.
- [ ] User can receive route suggestions that can be rendered by the existing map/explore UI.
- [ ] User can install or use the app with a basic PWA app shell and clear offline behavior.
- [ ] New AI/PWA behavior is covered by focused tests and verification steps.
- [ ] Existing lint/typecheck baseline is stabilized enough to trust project gates.

### Out of Scope

- Push notifications - deferred until the service worker, subscription storage, and notification delivery model are explicit.
- Full offline editing/sync conflict resolution - too broad for the first AI/PWA MVP.
- Full RAG over all images and travel history - defer until basic conversation persistence and route suggestions work.
- Multiple AI provider management UI - native server-side provider config is enough for v1.
- Mobile native app - web-first Nuxt/PWA project.

## Context

Codebase mapping exists in `.planning/codebase/` and should be treated as the source of truth for current implementation. It confirms a modular Nuxt/Nitro app with Vue components, Pinia stores, Drizzle/Turso data layer, Better Auth, S3 image storage, Nominatim search, Sentry, and map provider adapters.

The architecture diagrams describe AI/SSE/PWA capabilities, but current source does not yet include `server/api/ai/**`, AI conversation tables, PWA/service worker setup, or push notifications. `composables/useRouteGenerator.ts` is a local mocked route generator, not a real AI integration.

Current verification is weak: no test runner is configured, `pnpm lint` and `pnpm typecheck` fail on existing unrelated source issues, and CI currently runs lint only.

## Constraints

- **Tech stack**: Keep Nuxt 3/Nitro, Vue 3, Pinia, Drizzle/Turso, Better Auth, S3, and Sentry as the primary architecture - this is already implemented.
- **Workflow**: Roadmap uses Horizontal Layers - the user selected layer-oriented phases rather than vertical MVP phases.
- **Dependencies**: No new runtime dependency should be added casually; prefer native `fetch` for first OpenAI-compatible streaming slice unless an SDK is explicitly chosen.
- **Security**: AI provider keys must remain server-only and must not be exposed through `runtimeConfig.public`.
- **Privacy**: Do not log prompts, model responses, provider headers, or secrets.
- **Verification**: New AI/PWA work needs focused tests because the existing project has no test suite.
- **Documentation**: Treat diagram-only AI/PWA features as planned until matching source files exist.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Focus on AI/PWA MVP | User selected AI/PWA MVP as active project direction | - Pending |
| Use coarse roadmap granularity | User selected fewer, broader phases | - Pending |
| Include research artifacts | User selected research before roadmap | - Pending |
| Use Horizontal Layers roadmap | User selected Horizontal Layers over Vertical MVP | - Pending |
| Keep current Nuxt monolith | Existing architecture already supports server routes, auth, DB, and client UI in one app | - Pending |
| Mark AI/SSE/PWA as planned until implemented | Codebase map found diagrams but no matching source | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** via GSD workflow:
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone**:
1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---

*Last updated: 2026-05-08 after initialization*
