# Phase 2: Explore Inputs and Context Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 2-Explore Inputs and Context Layer
**Areas discussed:** City Autocomplete, Explore UI and Request Context, Candidate Places and Filters

---

## City Autocomplete

| Option | Description | Selected |
|--------|-------------|----------|
| Mapbox-first with fallback | Use Mapbox Search Box for city autocomplete and candidate/popular places where available; keep Nominatim fallback so Phase 2 can still work without new provider setup. | yes |
| Nominatim-first for now | Improve the existing Nominatim endpoint for live typeahead; defer Mapbox Search Box and popular provider places to later. | |
| Mapbox-only | Commit Phase 2 to Mapbox Search Box/category search and remove Nominatim from the Explore input path. | |

**User's choice:** Mapbox-first with fallback.
**Notes:** User asked for live typeahead and suggested researching the Mapbox API. The Mapbox Search Box suggest/retrieve model fits the desired autocomplete behavior. Existing Nominatim code remains useful as a fallback but needs hardening.

---

## Explore UI and Request Context

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor prototype UI into typed request context | Improve RoutePanel and related UI while producing a clean request context object for Phase 3 AI generation. | yes |
| Pass raw panel state to AI | Keep the existing prototype state shape and send it directly to the AI request later. | |
| Rebuild all Explore UI from scratch | Replace the existing Explore components entirely without preserving template intent. | |

**User's choice:** Refactor prototype UI into typed request context.
**Notes:** User said RoutePanel and related pieces should be refactored to use better UI and UX aligned with the design system. User was open to passing context to AI, but wanted a better approach if available. The selected decision is to prepare a typed Explore request context rather than sending raw component state.

---

## Candidate Places and Filters

| Option | Description | Selected |
|--------|-------------|----------|
| Popular places plus reusable filters | Show popular/candidate places for the selected city and build shared filter state that later generated routes can reuse. | yes |
| Generated-results filters only | Defer candidate places and only filter generated route results in later phases. | |
| Full generation history in Phase 2 | Add persisted generation history during input/context work. | |

**User's choice:** Popular places plus reusable filters.
**Notes:** User suggested adding history for generations and popular places on first attendance/page visit. Persistent generation history is deferred to Phase 3 because AI conversations/messages are scoped there. Phase 2 should prepare UI/state hooks and add popular candidate content where data is available.

---

## the agent's Discretion

- Exact Explore component split and visual control details.
- Exact Mapbox/Nominatim integration boundary.
- Exact typed request-context type names and store/composable organization.
- Exact candidate/popular-place ranking and default count.

## Deferred Ideas

- Persisted AI generation history belongs to Phase 3.
- Generated route map rendering belongs to Phase 4.
- Rich place popup data belongs to Phase 5 unless needed as a small candidate-place input slice.
