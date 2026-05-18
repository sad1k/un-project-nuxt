# Roadmap: WanderLog

**Created:** 2026-05-08
**Updated:** 2026-05-18 after adding Phase 7 advanced place storytelling
**Mode:** standard
**Granularity:** coarse
**Execution:** parallel where dependencies allow

## Overview

The project now centers on a fully working Explore page. The target user flow is:

```text
enter city with autocomplete -> choose days/interests -> AI generates route -> route appears on map with animations -> save to diary
```

The user selected a Horizontal Layers structure, so phases build the supporting layers first and then integrate them into a complete Explore experience.

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Explore Scope and Verification Foundation | Lock the Explore feature contract, preserve template intent, and make new Explore/AI work testable | FOUND-01, FOUND-02, FOUND-03, FOUND-04 |
| 2 | Explore Inputs and Context Layer | Implement city autocomplete, days/interests, search/filter controls, current location, saved places, and diary context selection | EXPIN-01, EXPIN-02, EXPIN-03, EXPIN-04, EXPIN-05 |
| 3 | AI Route Generation and Streaming | Add user-owned AI route conversations, streaming generation, follow-up questions, and structured route output | AIROUTE-01, AIROUTE-02, AIROUTE-03, AIROUTE-04, AIROUTE-05, AIROUTE-06 |
| 4 | Animated Map Route Experience | Render AI route markers, route line, day groups, animations, distance information, and saved places on the map | MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06 |
| 5 | Place Intelligence and Weather Tips | Add rich place popups with photos/reviews/ratings/cost/community signals and weather-aware route tips | PLACE-01, PLACE-02, PLACE-03, PLACE-04, PLACE-05, PLACE-06, TIPS-01, TIPS-02 |
| 5.1 | Route Generation Continuity and Completion Notifications | Keep route generation durable when users leave Explore, show global progress, restore completed output, and notify on completion | GENLIFE-01, GENLIFE-02, GENLIFE-03, GENLIFE-04, GENLIFE-05, GENLIFE-06 |
| 6 | Save to Diary and Release Hardening | Save generated routes/places into the diary and verify security, ownership, observability, and release readiness | DIARY-01, DIARY-02, DIARY-03, OBS-01, OBS-02, OBS-03 |
| 7 | Advanced Place Storytelling and Audio Narration | Add interactive place history/storytelling with audio narration, voice/language choices, and offline-ready playback caching | ADVPLACE-01, ADVPLACE-02, ADVPLACE-03 |

## Phase Details

### Phase 1: Explore Scope and Verification Foundation

**Goal:** Lock the Explore feature contract, preserve the current Explore template intent, update docs, and make new Explore/AI work testable before implementation.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md - Establish scoped verification scripts, server/data test harness, and quality baseline.
- [x] 01-02-PLAN.md - Lock Explore decision traceability and later-phase handoff contract.

**Success Criteria:**
1. PROJECT, REQUIREMENTS, ROADMAP, research docs, and phase context capture the full Explore feature list.
2. `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts` are documented as template/prototype assets to preserve conceptually, not exact implementation.
3. `.planning/**`, `.omx/**`, and `AGENTS.md` do not appear in project lint errors.
4. A focused verification path exists for new Explore/AI source work.
5. Current lint/typecheck blockers relevant to Explore work are listed or resolved.

**Canonical refs:**
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/research/FEATURES.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONCERNS.md`
- `components/explore/`
- `pages/explore.vue`
- `composables/useRouteGenerator.ts`

### Phase 2: Explore Inputs and Context Layer

**Goal:** Implement the non-AI input and context layer for Explore: city autocomplete, duration, interests, filters, current location, saved places, and diary context.

**Requirements:** EXPIN-01, EXPIN-02, EXPIN-03, EXPIN-04, EXPIN-05

**Success Criteria:**
1. User can search for a city with autocomplete suggestions.
2. User can choose trip days and interests before generation.
3. User can search/filter generated or candidate places.
4. User can include current location when browser permission/data is available.
5. User can include saved places and prior diary logs as route context.

### Phase 3: AI Route Generation and Streaming

**Goal:** Add the authenticated AI route layer: conversations/messages, streaming response text, follow-up questions, saved context usage, and structured route output.

**Requirements:** AIROUTE-01, AIROUTE-02, AIROUTE-03, AIROUTE-04, AIROUTE-05, AIROUTE-06

**Success Criteria:**
1. User can submit an Explore route-generation request.
2. Server validates request body and keeps provider credentials server-only.
3. Assistant response text streams to the client.
4. User can ask follow-up questions in the same conversation.
5. Server can include saved locations/logs as bounded context.
6. AI output includes structured route points that Phase 4 can render.

### Phase 4: Animated Map Route Experience

**Goal:** Turn structured AI route output into an animated map experience with route markers, lines, days, saved places, and distances.

**Requirements:** MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06

**Success Criteria:**
1. Generated route places appear as map markers.
2. Route line connects generated places in the planned order.
3. Day-by-day route grouping is visible and selectable.
4. Map animates when the route appears and when a user selects a place/day.
5. Distance information appears for route legs or selected places.
6. Saved places can be displayed alongside generated places without confusion.

### Phase 5: Place Intelligence and Weather Tips

**Goal:** Enrich place popups and route guidance with photos, reviews, ratings, costs, community visit signals, and weather-aware preparation tips.

**Requirements:** PLACE-01, PLACE-02, PLACE-03, PLACE-04, PLACE-05, PLACE-06, TIPS-01, TIPS-02

**Plans:** 3 plans

Plans:
- [ ] 05-01-PLAN.md - Create the server-side place intelligence contract and endpoint for rich generated-route popups.
- [ ] 05-02-PLAN.md - Render photo-first rich place popups for generated route markers.
- [ ] 05-03-PLAN.md - Add weather-aware route preparation tips to the Explore route sidebar.

**Success Criteria:**
1. Clicking a place opens a popup with name, description/info, and useful actions.
2. Popup shows place photos when available.
3. Popup shows reviews and rating when provider/app data is available.
4. Popup shows estimated cost when available.
5. Popup shows how many WanderLog users visited the place when app data exists.
6. Popup shows best-effort "users likely/currently there" app signal only when data supports it.
7. Route tips correlate weather with what the user should take.

**Notes:**
- Interactive audio history/storytelling is tracked as v2 unless pulled forward later.
- Community presence must not be fabricated.

### Phase 5.1: Route Generation Continuity and Completion Notifications

**Goal:** Decouple route generation from the active Explore page connection so users can leave Explore while a route is generating, see generation progress elsewhere in the app, recover the completed/failed result later, and receive a completion notification when available.

**Requirements:** GENLIFE-01, GENLIFE-02, GENLIFE-03, GENLIFE-04, GENLIFE-05, GENLIFE-06

**Plans:** 4 plans

Plans:
- [ ] 05.1-01-PLAN.md - Decouple AI route generation from the active Explore streaming connection.
- [ ] 05.1-02-PLAN.md - Expose active route-generation progress and recoverable route-session history in the interface.
- [ ] 05.1-03-PLAN.md - Add completion notifications with reliable in-app delivery and gated browser-push groundwork.
- [ ] 05.1-04-PLAN.md - Harden stale-job handling, observability, and end-to-end continuity verification.

**Success Criteria:**
1. Route generation continues server-side after the Explore page is left, refreshed, or temporarily disconnected.
2. A global app surface shows active route-generation status/progress and links back to the relevant route session.
3. Completed and failed background generations are persisted in user-owned route history and recoverable from the interface.
4. Users receive an in-app completion notification when still in the app.
5. Browser push notification is sent only when service worker support, permission, and a saved subscription are present; otherwise the feature degrades to visible in-app status.
6. Background generation, progress polling/stream replay, notification delivery, and history reads remain scoped to the authenticated user and use sanitized observability.

**Notes:**
- This phase is an urgent insertion discovered during live AI route testing.
- Current route persistence exists, but the streaming request is still coupled to the client connection; this phase owns the durable job boundary.
- General feed/travel notification preferences remain v2 unless this phase needs a narrow route-generation preference.

### Phase 6: Save to Diary and Release Hardening

**Goal:** Complete the Explore loop by saving generated routes/places into the diary and hardening security, ownership, observability, and release checks.

**Requirements:** DIARY-01, DIARY-02, DIARY-03, OBS-01, OBS-02, OBS-03

**Plans:** 3 plans

Plans:

**Wave 1**
- [x] 06-01-PLAN.md - Build idempotent automatic route-to-diary persistence.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md - Surface automatic saved-to-diary status in Explore.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-03-PLAN.md - Harden provider observability, ownership, credential exposure, and release verification.

Cross-cutting constraints:
- Completed generated routes automatically save to diary; there is no primary explicit "save route" step for successful completed routes.
- Each generated route point becomes one authenticated user's `locationLog`, with a created or reused matching authenticated user's `location`.
- Automatic diary save must be idempotent across retries, reloads, and route-history restore.
- Provider failure observability must not log raw prompts, raw model responses, provider headers, secrets, private route context, or sensitive location history.

**Success Criteria:**
1. User can save a generated route to the diary.
2. User can save selected places into existing location/location-log structures where appropriate.
3. Saved records remain scoped to the authenticated user.
4. AI, weather, review, and place-data failures are observable through sanitized logs or Sentry.
5. Provider credentials are not exposed to browser runtime config.
6. Cross-user data access is covered by tests or explicit verification.
7. Release checklist covers lint, typecheck, tests, build, and manual Explore map/browser verification.

### Phase 7: Advanced Place Storytelling and Audio Narration

**Goal:** Add interactive place history/storytelling with audio narration, voice/language choices, and offline-ready playback caching.

**Requirements:** ADVPLACE-01, ADVPLACE-02, ADVPLACE-03

**Plans:** 3 plans

Plans:

**Wave 1**
- [x] 07-01-PLAN.md - Build the grounded place story contract, persistence, and server audio generation endpoints.

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 07-02-PLAN.md - Render the route-sidebar story card, popup CTA, and explicit-tap player controls.

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 07-03-PLAN.md - Add explicit saved-audio offline playback states and Phase 7 verification.

Cross-cutting constraints:
- Story generation and playback require an explicit user tap.
- Stories require grounded provider facts plus route context; weak support returns unavailable instead of invented narration.
- TTS credentials stay server-only, and Phase 7 exposes no transcript/story text beyond title/status/source cues.
- `ADVPLACE-02` remains partial/deferred unless voice/language choice is deliberately reintroduced.

**Success Criteria:**
1. User can listen to interactive audio history/storytelling for a selected place.
2. User can choose between supported narration voices or languages. *(Deferred/partial in Phase 7 by discussion decision.)*
3. Place storytelling content can be cached for offline playback.

**Notes:**
- This phase pulls the advanced place experience from v2 into the roadmap after the v1 Explore loop.
- Storytelling appears primarily in the route sidebar; Mapbox popups expose only a compact "Listen to story" CTA.
- Planning clarified provider safeguards, caching boundaries, and the requirement split in `.planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-CONTEXT.md` and `07-RESEARCH.md`.

## Requirement Coverage

| Phase | Requirement Count |
|-------|-------------------|
| Phase 1 | 4 |
| Phase 2 | 5 |
| Phase 3 | 6 |
| Phase 4 | 6 |
| Phase 5 | 8 |
| Phase 5.1 | 6 |
| Phase 6 | 6 |
| Phase 7 | 3 |

All 41 v1 requirements are mapped to exactly one phase.
Phase 7 tracks 3 pulled-forward v2 advanced place requirements.

---

*Roadmap created: 2026-05-08*
*Last updated: 2026-05-18 after adding Phase 7 advanced place storytelling*
