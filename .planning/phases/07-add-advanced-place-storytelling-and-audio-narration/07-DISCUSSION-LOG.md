# Phase 7: Advanced Place Storytelling and Audio Narration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 7-Advanced Place Storytelling and Audio Narration
**Areas discussed:** Story Entry Point, Story Content Grounding, Narration Controls, Offline Playback Boundary

---

## Story Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Route sidebar | Best fit for a richer audio player, transcript, controls, and longer story content without fighting Mapbox popup constraints. | yes |
| Place popup | Keeps story closest to the selected marker, but the current popup is compact generated HTML and can get cramped fast. | |
| Dedicated story view | Best for immersive storytelling, but adds a larger new surface and navigation pattern. | |

**User's choice:** Route sidebar
**Notes:** Primary story surface should be the route sidebar.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline story card in route panel | Selecting a route point reveals a story/audio section directly in the existing sidebar flow. | yes |
| Expandable drawer inside sidebar | Keeps the route list compact until the user opens Story, then expands into a richer player/transcript. | |
| Popup CTA opens sidebar story | The map popup stays lightweight with a Listen to story action that focuses the sidebar player. | |

**User's choice:** Inline story card in route panel
**Notes:** Story appears inline in the existing route panel flow.

| Option | Description | Selected |
|--------|-------------|----------|
| Small CTA only | Popup remains photo-first and compact, with a Listen to story action that points users to the sidebar card. | yes |
| Short teaser plus CTA | Popup shows one sentence of story preview and a listen action, but risks crowding the rich place popup. | |
| No popup entry | Story appears only in the sidebar route point selection, keeping popups entirely focused on place facts. | |

**User's choice:** Small CTA only
**Notes:** Popup should not become the story surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit tap | Show a compact Place story card with a play/load button so audio generation and playback never surprise the user. | yes |
| Auto-open text, manual audio | The transcript/summary appears when the place is selected, but audio still requires a play action. | |
| Auto-open and preload | Fastest-feeling experience, but more provider/caching cost and more risk of doing work the user did not ask for. | |

**User's choice:** Explicit tap
**Notes:** No automatic audio playback or background generation on place selection.

---

## Story Content Grounding

| Option | Description | Selected |
|--------|-------------|----------|
| Provider facts + route context | Story uses available place/provider facts plus the route rationale/day context, with clear source/confidence cues. | yes |
| Provider facts + app diary context | More personal, but raises privacy and summarization boundaries. | |
| AI-generated travel vignette | Most atmospheric, but highest risk of unsupported facts unless heavily constrained. | |

**User's choice:** Provider facts + route context
**Notes:** Stories should be grounded in available place/provider facts plus route context.

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse the story and show unavailable | If there is not enough grounded place data, show Story unavailable rather than inventing history. | yes |
| Use route rationale only | Still gives a lightweight narration, but may feel more like route explanation than place history. | |
| Tell a clearly labeled imaginative vignette | Could be delightful, but changes the promise from factual storytelling to fictional ambience. | |

**User's choice:** Refuse the story and show unavailable
**Notes:** Weak factual support should not produce invented storytelling.

| Option | Description | Selected |
|--------|-------------|----------|
| Concise audio guide | Practical, warm, 60-120 seconds, focused on what makes the place worth noticing during the route. | yes |
| Deep historical mini-essay | More substantial, better for famous sites, but can feel too long for route pacing. | |
| Atmospheric travel narration | More immersive and poetic, but needs tighter factual guardrails to avoid drifting. | |

**User's choice:** Concise audio guide
**Notes:** Tone should be warm, practical, and concise.

| Option | Description | Selected |
|--------|-------------|----------|
| Compact source note | Show a small Based on provider/place data and route context note, with unavailable states when support is weak. | yes |
| Detailed source list | Better transparency, but can make a small story card feel like a research report. | |
| No visible source note | Cleanest UI, but weaker trust signal for AI-generated storytelling. | |

**User's choice:** Compact source note
**Notes:** Use compact trust cues, not a full citation block.

---

## Narration Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Small voice selector | Let users choose from a few simple labels without building provider-management UI. | |
| Single default voice | Fastest and simplest, but does not really satisfy the choose-between-voices requirement. | yes |
| Full voice catalog | More flexible, but risks turning this phase into audio-provider configuration work. | |

**User's choice:** Single default voice
**Notes:** Keep the first audio slice lean.

| Option | Description | Selected |
|--------|-------------|----------|
| Language selector | Keep one voice, but let users choose narration language for the generated story. | |
| No choice in Phase 7 | Treat ADVPLACE-02 as deferred/partial, and deliver basic narration first. | yes |
| Voice later, language now | Offer language now while explicitly deferring voice variety. | |

**User's choice:** No choice in Phase 7
**Notes:** `ADVPLACE-02` should be marked deferred/partial rather than falsely satisfied.

| Option | Description | Selected |
|--------|-------------|----------|
| Basic player controls | Play/pause, progress, replay, and loading/error states. | yes |
| Player plus transcript | Adds readable story text alongside audio, useful when audio is unavailable or muted. | |
| Full listening tools | Speed control, captions, skip sections, queue, and richer accessibility controls. | |

**User's choice:** Basic player controls
**Notes:** Keep controls focused for the first slice.

| Option | Description | Selected |
|--------|-------------|----------|
| Compact summary only | Show the short story premise/source note, but keep the experience audio-first. | |
| Expandable transcript | Better accessibility and fallback, but increases UI and generated-content surface. | |
| No text beyond title/status | Cleanest player, but weaker for muted/offline/error situations. | yes |

**User's choice:** No text beyond title/status
**Notes:** No transcript/story text in Phase 7.

---

## Offline Playback Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit saved audio only | Users tap a save/download control on a generated story; only those audio files are cached for offline playback. | yes |
| Recently played stories | Automatically cache what the user listens to, convenient but less transparent about storage/use. | |
| Story text/metadata only | Much easier technically, but does not really meet playback if audio is unavailable offline. | |

**User's choice:** Explicit saved audio only
**Notes:** Offline cache should be user-controlled.

| Option | Description | Selected |
|--------|-------------|----------|
| Generated route/session story cache | Saved audio belongs to the specific generated route/session/place story, matching Explore route context. | yes |
| Place-level reusable cache | One cached story per place, reusable across future routes, but harder because story content depends on route context. | |
| Diary-attached cache | Cache only after the route/place is saved to diary, giving persistence a clear home but making Explore playback less immediate. | |

**User's choice:** Generated route/session story cache
**Notes:** Saved audio is scoped to generated route/session/place story.

| Option | Description | Selected |
|--------|-------------|----------|
| Simple saved/offline badge | Story card shows states like Not saved offline, Saving, Available offline, Remove offline. | yes |
| Storage manager panel | Better for managing many downloads, but too much surface area for the first slice. | |
| No visible cache state | Keeps UI clean, but users will not know whether audio will work offline. | |

**User's choice:** Simple saved/offline badge
**Notes:** Offline state should be visible in the story card.

| Option | Description | Selected |
|--------|-------------|----------|
| Unavailable state | Show a clear Story not saved offline message and do not attempt generation/playback. | yes |
| Fallback to text/status | Could be softer, but no transcript/story text was selected for Phase 7. | |
| Queue for later | Nice, but becomes sync/job management work. | |

**User's choice:** Unavailable state
**Notes:** Offline unsaved stories should fail clearly rather than queueing or generating.

---

## the agent's Discretion

- Exact TTS/audio provider, storage location, schema, API shape, and implementation split.
- Exact labels, icons, player copy, and unavailable-state copy.
- Whether generation happens synchronously or through a small route-scoped server job.

## Deferred Ideas

- Voice selector and language selector.
- Full transcript, captions, speed controls, queues, and richer listening tools.
- Global place-level story library/reusable cache.
- Broad offline sync, storage manager panel, and queued offline generation.
