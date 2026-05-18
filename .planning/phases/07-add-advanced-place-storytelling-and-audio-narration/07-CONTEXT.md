# Phase 7: Advanced Place Storytelling and Audio Narration - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 adds grounded place storytelling and audio narration to the existing Explore route experience. It owns a route-sidebar story card for selected generated places, explicit audio generation/playback, factual support checks, source/status cues, and user-controlled offline saving for generated story audio. It does not build a full voice/language preference system, a transcript reader, global place-story library, broad offline sync, or unconstrained fictional travel narration.

</domain>

<decisions>
## Implementation Decisions

### Story Entry Point

- **D-01:** The primary storytelling surface should be the Explore route sidebar, not the compact Mapbox popup or a separate full-page story view.
- **D-02:** The route sidebar should show an inline story card in the route panel for the selected/generated place.
- **D-03:** The map popup should expose only a small "Listen to story" call-to-action that points users toward the sidebar story card.
- **D-04:** Story generation and audio playback should require an explicit user tap. The app must not surprise users with automatic audio playback or automatic background story generation when they select a place.

### Story Content Grounding

- **D-05:** Place stories should be grounded in provider facts plus route context, including the route rationale/day context when useful.
- **D-06:** Stories must not be free-floating fictional travel vignettes. If the system lacks enough grounded factual support, it should show a story-unavailable state rather than inventing history.
- **D-07:** When facts are available, the story tone should be a concise, warm audio guide, roughly 60-120 seconds, focused on what makes the place worth noticing during the route.
- **D-08:** The story card should show a compact source/status note, such as "Based on provider/place data and route context," instead of a detailed citation block.

### Narration Controls

- **D-09:** Phase 7 should use one default narration voice.
- **D-10:** Phase 7 should not expose a voice selector or language selector.
- **D-11:** `ADVPLACE-02` should be treated as intentionally deferred or partial for this phase, not falsely marked complete through a default voice.
- **D-12:** First-version playback controls should include only basic player states and controls: play/pause, progress, replay, loading, and error states.
- **D-13:** Phase 7 should not show transcript/story text beyond title, status, and compact source/status cues. The experience is audio-first.

### Offline Playback Boundary

- **D-14:** Offline playback means explicitly saved/downloaded audio only.
- **D-15:** Saved story audio should be scoped to the generated route/session/place story, not a global place-level story cache.
- **D-16:** The story card should show simple offline states and controls: not saved offline, saving, available offline, and remove offline.
- **D-17:** If the user is offline and taps a story that was not saved offline, show a clear unavailable state and do not attempt generation or playback.

### the agent's Discretion

- The planner may choose the exact TTS/audio provider, storage location, API shape, and persistence schema, provided provider credentials stay server-only and story generation remains grounded in available facts.
- The planner may choose exact labels, icons, player microcopy, and unavailable-state wording, provided users understand when story content is missing, loading, saved offline, or unavailable offline.
- The planner may decide whether audio generation happens synchronously from the story card or through a small server job, provided playback remains user-initiated and failures are recoverable without leaking private route context.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, privacy constraints, and prior note that narrated place history was deferred until place popup foundations were stable.
- `.planning/REQUIREMENTS.md` - `ADVPLACE-01`, `ADVPLACE-02`, and `ADVPLACE-03`; Phase 7 intentionally treats `ADVPLACE-02` as deferred/partial.
- `.planning/ROADMAP.md` - Phase 7 goal, success criteria, and pulled-forward advanced place requirement mapping.
- `.planning/STATE.md` - Current workflow state, Phase 7 addition, and known verification context.
- `.planning/phases/05-place-intelligence-and-weather-tips/05-CONTEXT.md` - Photo-first popup, grounded AI enrichment, missing-data placeholders, and provider/app-data constraints.
- `.planning/phases/05.1-route-generation-continuity-and-completion-notifications/05.1-CONTEXT.md` - Route history, service-worker/push groundwork, and offline/push boundaries.
- `.planning/phases/06-save-to-diary-and-release-hardening/06-CONTEXT.md` - Completed route persistence, route history, sanitized observability, and provider credential constraints.

### Codebase Maps and Research

- `.planning/codebase/STACK.md` - Nuxt, Nitro, Vue, Drizzle, Sentry, map, and current dependency stack.
- `.planning/codebase/ARCHITECTURE.md` - Authenticated API, data layer, provider integration, and existing warning about treating planned PWA diagrams as implemented source.
- `.planning/codebase/INTEGRATIONS.md` - Existing provider, Sentry, runtime config, cache, and server-only credential patterns.
- `.planning/research/FEATURES.md` - Earlier feature framing for interactive audio/history storytelling and PWA/offline support.
- `.planning/research/PITFALLS.md` - Offline/PWA cautions, including not caching authenticated mutations or hiding offline failures.

### Existing Source Touchpoints

- `components/explore/place-popup.ts` - Current compact photo-first popup renderer where only a lightweight story CTA should appear.
- `components/explore/route-panel.vue` - Primary route sidebar surface where the inline story card and audio player should live.
- `composables/use-place-intelligence.ts` - Existing client-side generated-place intelligence loading/cache pattern.
- `server/api/explore/place-intelligence.get.ts` - Existing authenticated place intelligence endpoint that grounds provider/app/route data.
- `public/route-generation-sw.js` - Existing narrow route-generation notification service worker; useful context but not a broad offline media cache.
- `lib/db/schema/ai-route.ts` - User-owned route session, variant, and route point model that can scope generated story/audio records.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `components/explore/route-panel.vue`: The existing route sidebar already owns route point lists, route weather tips, route history, and completed-route status. It is the best home for the inline story card.
- `components/explore/place-popup.ts`: Current popup output is compact generated HTML. It can carry a small story CTA but should not become the full player/transcript surface.
- `usePlaceIntelligence`: Shows a route-point-scoped client cache for generated place enrichment that Phase 7 can mirror or extend for story status.
- `server/api/explore/place-intelligence.get.ts`: Demonstrates an authenticated provider/app/route data boundary for generated route points.
- `aiRouteSession`, `aiRouteVariant`, and `aiRoutePoint`: Existing user-owned route/session/place identifiers can scope generated story audio and offline-save metadata.
- `public/route-generation-sw.js`: Existing service-worker code is narrow and notification-focused; Phase 7 should not assume a full app-shell/media cache exists.

### Established Patterns

- Provider credentials should remain server-only through env/runtime config boundaries.
- Generated/AI-enriched place content must be grounded in provider/app/route data and degrade clearly when support is weak.
- Authenticated server endpoints should use user ownership filters and avoid exposing another user's route/session/place data.
- Missing provider or factual support should produce explicit unavailable states rather than fabricated claims.
- Offline behavior should be explicit and visible; do not hide offline failures.

### Integration Points

- Add story CTA wiring from generated-place popup selection into the route sidebar story card.
- Add a story/audio server endpoint or route-scoped service that validates a user-owned route point and enough factual support before generating narration.
- Add client state/composable support for story loading, playback state, error/unavailable state, and offline-save state.
- Add persistent metadata for route/session/place story audio if needed, scoped to authenticated user and route identifiers.
- Add focused tests for grounded-story refusal, user ownership, server-only provider credentials, no transcript UI, player state rendering, and offline unavailable states.

</code_context>

<specifics>
## Specific Ideas

- User wants the actual player in the route sidebar, with only a small popup CTA.
- User wants story/audio generation and playback to happen only after an explicit tap.
- User wants factual support to be strict: no story if there is not enough grounded provider/place data.
- User chose a concise 60-120 second audio-guide tone.
- User chose no transcript and no story text beyond title/status/source cues.
- User wants explicit offline saving of generated audio, scoped to the generated route/session/place story.

</specifics>

<deferred>
## Deferred Ideas

- Voice selector and language selector are deferred; `ADVPLACE-02` should remain partial/deferred after Phase 7 unless the plan explicitly revises this decision.
- Full transcript, captions, speed controls, queues, and richer listening tools are deferred.
- Global place-level story libraries and reusable place-story caches are deferred.
- Broad offline sync, storage manager panels, and queued offline generation are deferred.

</deferred>

---

*Phase: 7-Advanced Place Storytelling and Audio Narration*
*Context gathered: 2026-05-18*
