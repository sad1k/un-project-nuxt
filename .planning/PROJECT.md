# WanderLog

## What This Is

WanderLog is a Nuxt 3 travel journaling platform for authenticated travelers who want to save places, record visits, attach images, view them on maps, and share selected memories in a social feed. The existing codebase already implements the core journal, feed, auth, database, S3 image flow, maps, and Sentry integration.

The active product direction is a fully working Explore page: a user enters a city with autocomplete, chooses trip days and interests, gets an AI-generated route with streamed explanation, sees the route animated on a map, inspects places with photos/reviews/ratings/costs/distance/community signals, receives weather-aware tips, and saves the generated route into the diary.

## Core Value

Users can turn their own travel context and preferences into an animated, explainable AI route that they can inspect on the map and save into their travel diary.

## Requirements

### Validated

- Existing user can authenticate with GitHub/Google OAuth through Better Auth - existing.
- Existing user can manage travel locations and location logs - existing.
- Existing user can upload and view images through S3-compatible storage - existing.
- Existing user can view locations and logs on maps through the current map layer - existing.
- Existing user can publish image-based posts, view feed items, like posts, and comment - existing.
- Existing server validates location/log/feed inputs with Zod and Drizzle-generated schemas - existing.
- Existing app reports errors through Sentry configuration - existing.
- Existing Explore code exists as a visual/prototype template in `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts` - existing template, not final behavior.

### Active

- [ ] User can enter a city with autocomplete on Explore.
- [ ] User can choose trip duration by days and select interests/filters.
- [ ] User can ask AI to generate a route and see streamed text while it works.
- [ ] User AI conversations and generated route results are persisted and scoped to that user.
- [ ] User can see generated route markers, route line, day-by-day route grouping, distances, and animated map transitions.
- [ ] User can search/filter route places and include current location, saved places, and diary history in route context.
- [ ] User can click a place and see a popup with info, photos, reviews/ratings, estimated cost, distance, and app-community visit signals.
- [ ] User can receive weather-correlated tips about what to take on the route.
- [ ] User can save a generated route or selected route places into the diary.
- [ ] User can ask follow-up questions to refine the generated route.
- [ ] Explore features are documented in PROJECT, REQUIREMENTS, ROADMAP, research docs, and phase context.
- [ ] New Explore/AI/PWA behavior is covered by focused tests and verification steps.

### Out of Scope

- Push notifications - deferred until the service worker, subscription storage, and notification delivery model are explicit.
- Full offline editing/sync conflict resolution - too broad for the first Explore/AI MVP.
- Full user-presence prediction accuracy for "who will be there now" - v1 can show best-effort app-community signals only if data exists.
- Full narrated audio history production pipeline - interactive place history/tour audio is a later enhancement after place popups work.
- Multiple AI provider management UI - native server-side provider config is enough for v1.
- Mobile native app - web-first Nuxt/PWA project.

## Context

Codebase mapping exists in `.planning/codebase/` and should be treated as the source of truth for current implementation. It confirms a modular Nuxt/Nitro app with Vue components, Pinia stores, Drizzle/Turso data layer, Better Auth, S3 image storage, Nominatim search, Sentry, and map provider adapters.

The architecture diagrams describe AI/SSE/PWA capabilities, but current source does not yet include `server/api/ai/**`, AI conversation tables, PWA/service worker setup, or push notifications. `composables/useRouteGenerator.ts` is a local mocked route generator and `components/explore/` is a template of the intended Explore experience, not an exact final design.

The user explicitly wants the Explore page to become fully working, with the core journey: city autocomplete -> choose days/interests -> AI generates route -> route appears on map with animations -> save to diary.

Current verification is weak: no test runner is configured, `pnpm lint` and `pnpm typecheck` fail on existing unrelated source issues, and CI currently runs lint only.

## Constraints

- **Tech stack**: Keep Nuxt 3/Nitro, Vue 3, Pinia, Drizzle/Turso, Better Auth, S3, and Sentry as the primary architecture - this is already implemented.
- **Explore template**: Preserve the intent of `components/explore/` as a template, but it can change substantially to become production behavior.
- **Dependencies**: No new runtime dependency should be added casually; prefer native `fetch` for first OpenAI-compatible streaming slice unless an SDK is explicitly chosen.
- **Security**: AI provider keys, weather/review provider keys, and any place-data provider keys must remain server-only unless explicitly safe for browser exposure.
- **Privacy**: Do not log prompts, model responses, provider headers, location-sensitive user context, or secrets.
- **Community signals**: App-community visit counts/current-time presence must use available app data or be clearly marked as estimates; do not fabricate live presence.
- **Verification**: New Explore/AI behavior needs focused tests because the existing project has no test suite.
- **Documentation**: Treat diagram-only AI/PWA features as planned until matching source files exist.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Make Explore the primary AI route planning surface | User requested a fully working Explore page with all listed features | - Pending |
| Use core Explore flow city -> days/interests -> AI route -> animated map -> save diary | User provided this as the desired end-to-end flow | - Pending |
| AI generates routes and streams text | User answered yes to AI route generation and streaming | - Pending |
| AI uses saved locations/logs and supports follow-up questions | User answered yes to both | - Pending |
| Preserve Explore template intent but allow redesign | User said `components/explore` is a template, not exact final UI | - Pending |
| Document features in all planning docs | User requested all docs be updated | - Pending |
| Mark high-complexity place intelligence as staged work | Reviews, weather, community presence, photos, costs, and audio/history need provider/data decisions | - Pending |

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

*Last updated: 2026-05-08 after Explore scope update*
