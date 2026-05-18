# Phase 7: Advanced Place Storytelling and Audio Narration - Research

**Researched:** 2026-05-18
**Status:** Ready for planning

## Research Question

How should WanderLog add grounded place storytelling, server-generated narration, and explicit saved-audio offline playback without overbuilding voice/language settings, transcripts, or a broad offline media platform?

## Recommendation

Use a three-slice implementation:

1. **Grounded story contract and server endpoints**: Add a route-point-owned story/narration contract that reuses existing place intelligence as the factual support gate. If provider facts plus route context are too weak, return a typed unavailable state.
2. **Route sidebar story player**: Add an inline route-panel story card plus a small popup CTA. The card triggers generation/playback only after an explicit tap, uses one default voice, and shows only title/status/source cues.
3. **Explicit saved-audio offline support**: Cache only user-requested generated audio for a specific route/session/place story, with visible save/remove/offline states and a clear unavailable state when offline audio was not saved.

This should be planned as three dependent waves: server/data contract first, player UI second, offline cache third.

## Primary Documentation Findings

- OpenAI's Text to Speech guide documents an Audio API `speech` endpoint with `gpt-4o-mini-tts`, built-in voices, default MP3 output, and optional streaming/output formats. It also requires a clear disclosure that users are hearing an AI-generated voice. Source: https://developers.openai.com/api/docs/guides/text-to-speech
- The same guide shows `POST /v1/audio/speech` can be called over HTTP and can produce MP3 by default or other formats such as WAV/PCM. This fits the repo's existing native-`fetch` provider style and avoids adding the OpenAI SDK.
- MDN documents `HTMLAudioElement` / `Audio()` as a widely available way to play audio from a URL, and notes loading/playability events such as `canplay` and `canplaythrough`. Source: https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement/Audio
- MDN documents `CacheStorage` and `Cache` as secure-context APIs available from window/worker scopes. Cache entries require explicit maintenance, do not automatically expire unless deleted, and can be evicted by browser storage pressure. Sources: https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage and https://developer.mozilla.org/en-US/docs/Web/API/Cache
- MDN documents service workers as network/offline intermediaries, but they run without DOM access and are asynchronous worker contexts. WanderLog already has a narrow route-generation notification service worker, so Phase 7 should not assume a broad app-shell/media service worker exists. Source: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

## Codebase Findings

### Existing Assets to Reuse

- `server/api/explore/place-intelligence.get.ts` already authenticates, validates route point queries, re-reads user-owned route points, fetches provider place data, and returns a typed place intelligence object.
- `lib/explore/place-intelligence.ts` already models source/confidence, provider facts, route rationale, missing data slots, and unavailable place intelligence.
- `components/explore/place-popup.ts` is a pure compact popup renderer. It is appropriate for a small "Listen to story" CTA, not an audio player.
- `components/explore/route-panel.vue` already hosts route point lists, route weather tips, route history, and diary save status. It is the right parent surface for an inline story card.
- `composables/use-place-intelligence.ts` already demonstrates route-point-scoped client cache shape and graceful unavailable fallback.
- `lib/db/schema/ai-route.ts` and `lib/db/queries/ai-route.ts` already provide user-owned route session/variant/point identifiers and an ownership-safe `findAiRoutePointForPlaceIntelligence` query.
- Existing S3 utilities and endpoints show the app can store media through S3-compatible storage, but current image endpoints contain direct logging and are diary-image-specific. Story audio storage should use a new narrow path with sanitized observability, not copy unsafe logging.
- Existing node tests under `tests/server/*.test.mjs` are mostly source-level focused tests. Phase 7 should follow that pattern first, with browser/manual checks for actual playback.

### Constraints

- Do not read or expose `.env`. Use `lib/env.ts` as the safe source of environment names.
- TTS provider credentials must be server-only. No `OPENAI_API_KEY`, future `OPENAI_TTS_*`, S3 secret, or provider secret should appear in `runtimeConfig.public` or client code.
- The repo currently uses native `fetch` for OpenAI-compatible route generation. Prefer a small native-fetch TTS adapter over a new SDK dependency.
- Story generation must be grounded in provider facts plus route context. Do not use raw diary history or produce fictional vignettes.
- `ADVPLACE-02` is intentionally deferred/partial by context decision. Plans should not pretend one default voice satisfies voice/language choice.
- Offline caching should be explicit and visible. Do not auto-cache recently played stories or queue offline generation.
- The current service worker is only `public/route-generation-sw.js` for notifications. Cache API use from the story composable is enough for explicit saved audio; a new broad PWA layer is not required unless execution proves it necessary.

## Proposed Architecture

### Server/data

- Add `lib/explore/place-story.ts` with Zod contracts:
  - story status: `available`, `unavailable`, `generating`, `failed`
  - source/status note
  - generated audio metadata: content type, duration when known, cache key, storage key, generatedAt
  - no transcript/story text returned to the client except short title/status/source cues
- Add a persistence table such as `routePlaceStory`:
  - `userId`, `sessionId`, `variantId`, `routePointId`
  - `status`, `failureCode`, `sourceSupportJson` or compact support metadata
  - `audioObjectKey`, `audioContentType`, `audioByteLength`, `audioDurationSeconds`
  - `offlineSavedAt` or client-visible saved metadata if server-side tracking is useful
  - unique key on `userId`, `sessionId`, `variantId`, `routePointId`
- Add `lib/db/queries/route-place-story.ts` for ownership-safe lookup/upsert.
- Add `lib/ai/place-story.ts` or `lib/explore/place-story-provider.ts`:
  - builds the 60-120 second audio-guide input from provider place facts plus route rationale/day context;
  - refuses generation when facts are weak;
  - calls TTS over native `fetch`;
  - stores generated audio in S3-compatible object storage or returns a server-streamed response while recording metadata.
- Add endpoints:
  - `GET /api/explore/place-story` for current story availability/status and existing audio metadata.
  - `POST /api/explore/place-story/generate` for explicit tap generation/playback.
  - Optional `GET /api/explore/place-story/audio` for authenticated audio streaming if direct S3 URLs should not be exposed.

### Client/UI

- Add `components/explore/place-story-card.vue` inside `route-panel.vue`.
- Add `composables/use-place-story.ts` to load status, call generation, manage `HTMLAudioElement`, and track playback progress/replay/error state.
- Add a small "Listen to story" CTA to `components/explore/place-popup.ts`; route it through the existing popup/marker callback path by selecting/focusing the route point in the sidebar.
- Keep UI text minimal: title/status/source note only. No transcript.
- Include a visible AI-voice disclosure in or near the story card because OpenAI policy requires end-user disclosure for AI-generated voices.

### Offline

- Use `CacheStorage.open("wanderlog-place-story-audio-v1")` from the client composable for explicit saved audio.
- Use a stable cache request URL/key derived from authenticated story audio URL plus route/session/variant/routePoint identity.
- "Save offline" should fetch the authenticated audio URL, verify an OK response and audio content type, then `cache.put(request, response.clone())`.
- "Remove offline" should `cache.delete(request)` and update UI state.
- On playback, prefer cached response when offline and saved; otherwise use the online authenticated audio URL.
- If offline and no cached response exists, show "Story not saved offline" and do not attempt generation.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Story provider invents unsupported place history. | high | Require place intelligence support threshold before generation; return unavailable for weak support; add tests that missing facts do not call TTS. |
| TTS provider key leaks to browser runtime. | high | Keep adapter server-only; add source tests for env/runtimeConfig/client exposure. |
| Generated audio is accessible across users. | high | Scope story metadata and audio endpoint by authenticated `userId`, `sessionId`, `variantId`, and `routePointId`; avoid public predictable object keys. |
| Cache API gives false certainty about offline availability. | medium | Make offline save explicit, verify cache match before showing available, and show clear unavailable states because browser storage can evict cache data. |
| Phase drifts into voice/language settings. | medium | Mark `ADVPLACE-02` partial/deferred in plan success criteria and avoid selectors in UI. |
| Audio generation blocks route UX. | medium | Use explicit tap and loading/error states; keep generation scoped to one story at a time. |
| Existing S3 utilities include direct logging. | medium | Use sanitized observability helper or no direct logs for story audio paths. |

## Verification Strategy

- Add focused source tests before implementation:
  - story schema/query/endpoints exist and enforce `userId`;
  - weak factual support returns unavailable and does not call provider/TTS;
  - provider/TTS secrets do not appear in client/runtime public config;
  - popup only exposes a small CTA, while route panel owns the story card;
  - story card has basic player states and no transcript UI;
  - offline cache code uses explicit save/remove and unavailable state.
- Run focused story tests after each wave.
- Run `pnpm test:server` and `pnpm lint:source` after Phase 7 plans.
- Run `pnpm typecheck` and `pnpm build` as release checks, but preserve existing known blockers from Phase 6 verification if they still fail.
- Manual/browser verification should cover selecting a generated place, tapping story playback, seeing unavailable state for weak support, saving/removing offline audio, and offline unsaved behavior.

## Plan Shape

Recommended plans:

1. `07-01-PLAN.md` - Grounded story contract, persistence, TTS adapter, and server endpoints.
2. `07-02-PLAN.md` - Route sidebar story card, popup CTA, player controls, and story client composable.
3. `07-03-PLAN.md` - Explicit saved-audio offline cache, offline states, verification, and release notes.

## Open Questions for Execution

- Which exact default voice should the first TTS adapter use? Planning can pick a single stable default such as `coral`, `marin`, or `cedar`, but should keep it server-configurable.
- Should story audio be stored permanently in S3 immediately or generated on demand then cached by the browser? Recommendation: persist generated audio metadata/server object so explicit offline save has a stable authenticated URL.
- Should story generation use the existing route LLM provider for text planning before TTS, or rely on provider facts plus a deterministic prompt sent directly to TTS? Recommendation: keep one TTS call if the provider can follow style instructions; add a separate text generation step only if needed later.

---

*Research generated inline from GSD plan-phase workflow because `gsd-sdk`/subagent runtime is unavailable in this Codex App session.*
