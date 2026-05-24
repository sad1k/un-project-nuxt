# Roadmap: WanderLog

**Created:** 2026-05-08
**Updated:** 2026-05-23 after executing Phase 13 e2e load verification
**Mode:** standard
**Granularity:** coarse
**Execution:** parallel where dependencies allow

## Overview

The project now centers on a fully working Explore page. The target user flow is:

```text
enter city with autocomplete -> choose days/interests -> AI generates route -> route appears on map with animations -> save to diary
```

The user selected a Horizontal Layers structure, so phases build the supporting layers first and then integrate them into a complete Explore experience.

After the Explore/Admin foundation, the next product layer lets travelers contribute real place photos: attach a photo to an attraction, pin or confirm it on the map, keep it private by default, and explicitly make it public so other users can see it in place/map surfaces.

The next enrichment layer makes generated-route place photos more reliable by resolving real media through a deterministic provider/cache pipeline rather than using AI or illustrative substitutes.

The next social discovery layer connects public traveler photo posts with a live feed globe: users can quickly publish a photo to the feed, and public photo posts appear as live points on a Mapbox globe tab with bounded density so nearby bursts stay beautiful instead of noisy.

The current quality layer adds local e2e load and performance verification for the social/photo surfaces: synthetic users create places, upload photos through the real S3-compatible flow, publish posts, and exercise feed/public reads while request timings and thresholds are recorded.

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
| 8 | Mobile PWA Foundation | Establish the mobile web app foundation for installability, service-worker boundaries, offline-ready shell behavior, and mobile verification | TBD during phase discussion |
| 9 | Admin Route Generation Observability and Improvement Loop | Add an admin surface for inspecting generated routes, failed route sessions, sanitized failure reasons, and service-improvement signals | TBD during phase discussion |
| 10 | Traveler Place Photo Uploads and Public Map Sharing | Let travelers attach photos to attractions, mark them on the map, and explicitly publish selected photos for all users to view | PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05, PHOTO-06 |
| 11 | Real Place Photo Provider and Cache Pipeline | Resolve generated-route place photos from real WanderLog/provider media with legal cache boundaries and explicit missing-photo fallback | REALPHOTO-01, REALPHOTO-02, REALPHOTO-03, REALPHOTO-04, REALPHOTO-05, REALPHOTO-06 |
| 12 | Live Feed Globe and Photo Post Map Layer | Add quick feed publishing for place photos and a public live Mapbox globe tab where photo posts appear as bounded real-time points | LIVEGLOBE-01, LIVEGLOBE-02, LIVEGLOBE-03, LIVEGLOBE-04, LIVEGLOBE-05, LIVEGLOBE-06 |
| 13 | E2E Load and Performance Verification | Add a local e2e load and performance verification harness for synthetic users, real S3-compatible photo uploads, feed posts, custom places, and feed/public reads | Load/performance verification |

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
2. Popup shows real provider-sourced or WanderLog app-owned place photos when available, and otherwise shows an explicit missing-photo state instead of an AI/illustrative substitute.
3. Popup shows reviews and rating when provider/app data is available.
4. Popup shows estimated cost when available.
5. Popup shows how many WanderLog users visited the place when app data exists.
6. Popup shows best-effort "users likely/currently there" app signal only when data supports it.
7. Route tips correlate weather with what the user should take.

**Notes:**
- Interactive audio history/storytelling is tracked as v2 unless pulled forward later.
- Community presence must not be fabricated.
- Place photos must be real media from provider/app sources; generated or stock-like illustrative images are not valid substitutes for PLACE-02.

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
- [x] 07-02-PLAN.md - Render the route-sidebar story card, popup CTA, and explicit-tap player controls.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md - Add explicit saved-audio offline playback states and Phase 7 verification.

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
- Phase 7 implementation is complete with `ADVPLACE-02` partial/deferred and release blockers recorded in `07-VERIFICATION.md`.

### Phase 8: Mobile PWA Foundation

**Goal:** Establish the mobile web app foundation for installability, service-worker boundaries, offline-ready shell behavior, and mobile verification.

**Depends on:** Phase 7

**Requirements:** TBD during phase discussion

**Plans:** 3 plans

Plans:

**Wave 1**
- [x] 08-01-PLAN.md - Make WanderLog installability explicit with manifest, icons, head metadata, and focused tests.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md - Create a unified notification-preserving service worker and safe offline shell.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-03-PLAN.md - Add mobile PWA install/status UX and final Phase 8 verification.

Cross-cutting constraints:
- Phase 8 is web/PWA foundation only; native mobile app work remains out of scope.
- Do not add `@vite-pwa/nuxt`, Workbox, or any new dependency unless the user explicitly approves it.
- Service-worker caching must not include authenticated API responses, provider responses, S3 assets, map tiles, or story audio.
- Offline support is limited to installability, app shell, static fallback, route-generation notification support, and explicit user-saved audio behavior.

**Success Criteria:**
1. Mobile PWA installability requirements are explicit and verifiable.
2. Manifest, icons, service worker, and cache boundaries are defined without expanding into full offline editing/sync.
3. Mobile route, diary, and Explore shell behavior is covered by focused verification.
4. PWA credentials, notification permissions, and storage behavior remain server-safe and privacy-aware.

**Notes:**
- Planned without `08-CONTEXT.md` by user choice; scope comes from ROADMAP, PROJECT/REQUIREMENTS out-of-scope boundaries, codebase evidence, and `08-RESEARCH.md`.
- Native mobile app work remains out of scope; this phase is web/PWA foundation only.

### Phase 9: Admin Route Generation Observability and Improvement Loop

**Goal:** Add an authenticated admin surface for reviewing generated route sessions, understanding why route generation failed, and turning sanitized operational evidence into concrete service-improvement actions.

**Depends on:** Phase 8

**Requirements:** TBD during phase discussion

**Plans:** 3 plans

Plans:

**Wave 1**
- [x] 09-01-PLAN.md - Create the role-backed admin authorization foundation for Phase 9.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md - Add admin route-generation data access, APIs, and normalized failure taxonomy.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-03-PLAN.md - Build the admin route-generation observability UI and final verification.

Cross-cutting constraints:
- Admin access must be explicitly authorized and unavailable to regular users.
- Diagnostics must stay sanitized: no raw prompts, raw model responses, provider headers, secrets, private route context, or sensitive location history.
- Failure reasons should be classified into actionable buckets such as validation, provider timeout, provider refusal, malformed route output, place enrichment failure, persistence failure, notification failure, and unknown.
- The dashboard should support analysis and improvement without creating a hidden model-training pipeline or exposing private user content.

**Success Criteria:**
1. Admin can view recent generated route sessions with status, timing, city/duration/interests summary, user-safe identifiers, and generated-route availability.
2. Admin can filter sessions by status, failure bucket, provider/model, date range, and route-generation stage.
3. Failed sessions show sanitized error summaries, stage-level diagnostics, retryability, and links to relevant internal logs/events when available.
4. Admin can inspect aggregate failure patterns and route-quality signals to identify service improvements.
5. Admin-only routes, APIs, and database reads are covered by authorization and privacy-focused tests.
6. The service records enough structured, sanitized events to explain failures without logging sensitive route content.

**Notes:**
- This phase was added after the user requested an admin panel to view generated routes, understand failures, analyze patterns, and improve the service.
- Implementation should reuse the existing route-session persistence, status, notification, and sanitized observability work from Phases 3, 5.1, and 6.
- Planning should decide whether this is an internal admin-only feature, a developer diagnostics page, or both.
- Phase 9 implementation is complete with role-backed admin APIs/pages, sanitized list/detail views, hybrid failure taxonomy, and verification artifacts. Release blockers remain `pnpm typecheck` existing project errors, `pnpm build` timeout, local schema rollout, and manual admin/non-admin browser verification.

### Phase 10: Traveler Place Photo Uploads and Public Map Sharing

**Goal:** Let authenticated travelers attach their own photos to attractions, confirm or adjust the photo's map location, and explicitly publish selected photos so they appear for all users in place and map surfaces.

**Depends on:** Phase 9

**Requirements:** PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05, PHOTO-06

**Plans:** 3 plans

Cross-cutting constraints:
- Photo uploads must reuse the existing authenticated image/S3 flow where possible instead of introducing a new storage path.
- Photos are private by default; public visibility requires an explicit user action.
- Public photos must expose only safe, intentional metadata and must not leak private diary context, hidden location notes, or provider/user secrets.
- Map placement should reuse existing location/map primitives and support both known attractions and user-confirmed coordinates.
- Public photo reads should be designed for moderation/removal and abuse handling even if full moderation tooling is staged.

Plans:

**Wave 1**
- [x] 10-01-PLAN.md - Create the public place photo data model, owner visibility APIs, unauthenticated public read API, and privacy tests.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md - Build the mobile-first camera/GPS place-photo capture flow that saves private diary records.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-03-PLAN.md - Add the public photo map layer, owner publish/unpublish controls, and final Phase 10 verification.

**Success Criteria:**
1. Authenticated user can attach a photo to an existing or newly selected attraction/place.
2. User can confirm or adjust the photo's marker/location on the map before saving.
3. Uploaded photo remains scoped to the owner unless they explicitly mark it public.
4. Public photos appear to other users in relevant place popups, map markers, or place photo galleries.
5. Owner can make a public photo private again or remove it from public display.
6. Upload, visibility, ownership, public read, and map-display behavior are covered by focused tests and privacy/security verification.

**Notes:**
- This phase was added after the user requested traveler-facing photo contributions: attach photos to attractions, mark them on the map, and optionally publish them globally.
- Planning should decide whether public photos appear first in Explore place popups, dashboard maps, feed/community surfaces, or a minimal shared place gallery.
- Implementation completed with private-by-default `locationLogImage` visibility fields, a mobile camera/GPS capture flow, an unauthenticated public photo map layer, and owner publish/unpublish controls. Verification is recorded in `.planning/phases/10-traveler-place-photo-uploads-and-public-map-sharing/10-VERIFICATION.md`.

### Phase 11: Real Place Photo Provider and Cache Pipeline

**Goal:** Make generated-route place photos come from real media sources only, using public WanderLog place photos and configured provider/open-media sources with legal cache boundaries and explicit missing-photo fallback.

**Depends on:** Phase 5, Phase 10

**Requirements:** REALPHOTO-01, REALPHOTO-02, REALPHOTO-03, REALPHOTO-04, REALPHOTO-05, REALPHOTO-06

**Plans:** 3 plans

Cross-cutting constraints:
- Real place media only: AI-generated, stock-like, or illustrative images must not be shown as place photos.
- Public WanderLog photos should be preferred before external provider media when a safe place/coordinate match exists.
- Provider credentials remain server-only; provider headers, photo references, and private route context must not be logged.
- Cache provider metadata and expiry, not permanent copied image binaries, unless the source terms explicitly allow durable storage.
- Missing photos remain an honest UI state, not a reason to fabricate imagery.

Plans:

**Wave 1**
- [x] 11-01-PLAN.md - Build the place media cache contract, source taxonomy, and tests.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 11-02-PLAN.md - Implement the real-photo source chain for public WanderLog, Google Places, and open/provider fallback.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 11-03-PLAN.md - Integrate real-photo resolution into Explore popups, API docs, observability, and final verification.

**Success Criteria:**
1. Generated-route place photos use the source order public WanderLog photos -> Google Places Photos -> optional open/provider fallback -> missing-photo state.
2. The place media cache records source, attribution, provider identity, expiry, and failure state without secrets or private route context.
3. Google photo media is resolved with fresh server-side references and short-lived response caching, not permanent unlicensed S3 copies.
4. Public WanderLog place photos can appear in Explore place popups when they match the generated place safely.
5. Tests prevent AI/illustrative images from entering `PlacePhoto` and verify missing-photo fallback behavior.
6. Release verification covers focused server tests, source lint where practical, and sanitized secret/logging checks.

**Notes:**
- Phase 11 implementation is complete with real-media-only place photo resolution, source/attribution popup labels, OpenAPI documentation, focused test coverage, and verification artifacts in `.planning/phases/11-real-place-photo-provider-and-cache-pipeline/11-VERIFICATION.md`.
- Release blockers remain project-wide lint/typecheck issues outside Phase 11 source, pending `placeMediaCache` schema rollout, and manual browser verification with a live provider key.

### Phase 12: Live Feed Globe and Photo Post Map Layer

**Goal:** Connect feed publishing with public map discovery by adding a quick photo-to-feed action and a public live Mapbox globe tab where newly created photo posts appear as animated points.

**Depends on:** Phase 10, Phase 11

**Requirements:** LIVEGLOBE-01, LIVEGLOBE-02, LIVEGLOBE-03, LIVEGLOBE-04, LIVEGLOBE-05, LIVEGLOBE-06

**Plans:** 3 plans

Plans:
- [x] `12-01`: Public post/globe data contract, quick publish hardening, and safe unauthenticated payload tests.
- [x] `12-02`: Feed tab, Mapbox globe component, popup rendering, quick publish affordance, and pure density limiter.
- [x] `12-03`: Live/near-live update channel, polling fallback, OpenAPI docs, and final verification.

Cross-cutting constraints:
- The globe should use public post/photo data only and must not expose private diary text, hidden route context, or private user metadata.
- Globe points use exact public coordinates because only intentionally public photos/posts appear on this surface.
- The feed globe is visible to everyone, including unauthenticated visitors, while publishing remains authenticated and owner-scoped.
- Dense areas should stay visually bounded: show at most 3-4 active points in a local radius and replace the oldest visible point when a new one appears, while preserving a `+N`/overflow signal for hidden posts.
- Treat "real-time" as live-feeling post discovery; planner may choose SSE, polling, or an existing app-friendly update path without adding a new dependency casually.

**Success Criteria:**
1. Authenticated user can quickly publish an uploaded place photo to the feed through a clear feed-oriented action.
2. Feed includes a tab/surface that opens a global Mapbox globe for a wow-effect view of public photo posts.
3. New public photo posts appear on the globe as live/near-live animated points.
4. When more than 3-4 posts appear in the same local radius, the surface keeps only the newest bounded set visible and hides/replaces older points with a clear overflow indicator.
5. Globe point popups show only photo, place, author display name, and date.
6. Public reads, live updates, density limiting, and privacy-safe payloads are covered by focused tests and visual/browser verification where practical.

**Notes:**
- This phase was added after the user requested unifying Mapbox and the feed into a live globe of public photo posts.
- The feature should feel social and cinematic, but it should reuse the existing feed, post, public photo, S3, and Mapbox primitives rather than becoming a separate social product.
- Phase 12 implementation is focused-source verified with 27/27 Phase 12 tests passing. Release blockers remain project-wide lint/typecheck/build issues and manual browser verification; see `.planning/phases/12-live-feed-globe-and-photo-post-map-layer/12-VERIFICATION.md`.

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
| Phase 8 | 0 |
| Phase 9 | 0 |
| Phase 10 | 6 |
| Phase 11 | 6 |
| Phase 12 | 6 |
| Phase 13 | 0 |

All 41 v1 requirements are mapped to exactly one phase.
Phase 7 tracks 3 pulled-forward v2 advanced place requirements.
Phase 8 has no mapped requirement IDs because the mobile PWA foundation scope was clarified through phase planning rather than requirement IDs.
Phase 9 is newly added and has no mapped requirement IDs until discussion/planning clarifies the admin observability scope.
Phase 10 tracks 6 traveler photo-sharing requirements added after Phase 9.
Phase 11 tracks 6 real place photo enrichment requirements added after the user chose real photos only for generated-route places.
Phase 12 tracks 6 live feed globe requirements added after the user requested public photo posts on a global Mapbox feed tab.
Phase 13 has no mapped requirement IDs because it is a load/performance verification phase scoped by discussion decisions rather than product requirement IDs.

### Phase 13: E2E Load and Performance Verification

**Goal:** Add a local e2e load and performance verification harness for the completed photo, place, post, and feed surfaces, targeting 100 synthetic users, 1000 real S3-compatible photo uploads, and 1000 feed posts over 10 minutes with request timing thresholds.

**Requirements**: TBD during Phase 13 execution
**Depends on:** Phase 12
**Plans:** 3/3 plans complete

Plans:

**Wave 1**
- [x] 13-01-PLAN.md - Build the local load identity, auth seeding, run manifest, and metrics foundation.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 13-02-PLAN.md - Implement the balanced e2e social/photo load scenario with full S3-compatible upload.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 13-03-PLAN.md - Add run-id cleanup, reporting, scripts, docs, and final Phase 13 verification. (completed 2026-05-23)

Cross-cutting constraints:
- Phase 13 targets local DB load only; it is not a production capacity claim.
- Full S3-compatible upload is required and must be explicitly opted into because storage may be external even when the DB is local.
- Load data is preserved after runs for diagnostics; cleanup must be a separate explicit command by run id.
- Reports must include p50, p95, p99, RPS, status codes, error counts, timeout counts, read/write p95, and threshold pass/fail.
- Practical local thresholds are read p95 <= 800ms, write p95 <= 1500ms, error rate <= 1%, and timeout rate <= 0.5%.

**Success Criteria:**
1. A developer can seed 100 synthetic local users with app-verified sessions for load testing.
2. The load harness can create 1000 photos through the real signed S3-compatible upload flow and publish 1000 feed posts over a 10-minute profile.
3. The profile also creates custom places and exercises normal feed, public place photo, and feed globe read paths.
4. Reports show per-step and aggregate request timing metrics, read/write threshold checks, status codes, errors, and timeouts.
5. Test data remains available for local diagnostics and can be explicitly cleaned by run id, including best-effort S3 object cleanup.

**Notes:**
- Phase 13 was added after the user requested e2e load testing for many users, photo uploads, feed posts, custom places, and normal feed requests.
- The user selected local DB, 100 users / 1000 photos / 1000 posts / 10 minutes, practical local thresholds, full S3-compatible upload, direct DB user seeding, preserved test data, explicit cleanup, and a balanced social/photo load mix.
- Planning context is captured in `.planning/phases/13-e2e-load-and-performance-verification/13-CONTEXT.md`.

---

*Roadmap created: 2026-05-08*
*Last updated: 2026-05-23 after executing Phase 13 e2e load verification*
