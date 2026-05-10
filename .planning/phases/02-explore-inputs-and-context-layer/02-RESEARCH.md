# Phase 2: Explore Inputs and Context Layer - Research

**Researched:** 2026-05-09
**Status:** Ready for planning

## Research Question

How should WanderLog implement the Explore input and context layer so city autocomplete, trip preferences, filters, current location, saved places, diary logs, and candidate/popular places are ready for Phase 3 AI route generation without prematurely implementing AI persistence or map route rendering?

## Summary

Phase 2 should create a typed Explore request context boundary and a redesigned input UI around it. The best provider direction is Mapbox-first for live typeahead and candidate/popular-place search, with the existing Nominatim endpoint hardened as a fallback. The implementation should avoid new dependencies, use native `fetch` from Nitro/server utilities where possible, and add focused tests around request normalization, fallback behavior, and ownership-safe personal-context shaping.

## Provider Research

### Mapbox Search Box

Mapbox Search Box is the right primary direction for live autocomplete. The API is designed around an interactive search session: a suggest step while the user types and a retrieve step when the user selects a suggestion. Planning should preserve a shared session token across that interaction so billing/ranking/session semantics stay correct.

Relevant docs:
- `https://docs.mapbox.com/api/search/search-box/`
- `https://docs.mapbox.com/mapbox-search-js/guides/`

Implementation implications:
- Store selected city as a structured object, not a string: provider, provider id or mapbox id, display name, coordinates, bbox/context when available, and source attribution if needed.
- Prefer a Nitro proxy or server utility for calls that need sensitive configuration. `nuxt.config.ts` currently exposes `MAPBOX_TOKEN` through `runtimeConfig.public.mapboxToken` for the map, so planning must explicitly decide which search calls are safe client-side and which belong server-side.
- Do not add `@mapbox/search-js-*` unless execution explicitly chooses that dependency later; native `fetch` is enough for a first provider slice.

### Nominatim Fallback

The current fallback route exists at `server/api/search-locations.get.ts` and is authenticated/cached, but it is not ready for live typeahead without fixes.

Relevant docs:
- `https://nominatim.org/release-docs/latest/api/Search/`
- `https://operations.osmfoundation.org/policies/nominatim/`

Implementation implications:
- Use `URL` and `URLSearchParams`; do not interpolate raw query strings.
- Normalize cache keys by trimming/collapsing whitespace and lowercasing where appropriate.
- Add a minimum query length and debounce on the client; Nominatim public usage policy is not a good fit for high-frequency autocomplete traffic.
- Remove debug logging and return sanitized provider errors.
- Convert Nominatim results into the same `ExploreCitySuggestion` shape as Mapbox so UI code does not branch deeply by provider.

## Codebase Findings

### Current Explore Prototype

- `pages/explore.vue` is a full-screen prototype that wires directly to `useRouteGenerator()`.
- `components/explore/RoutePanel.vue` contains the current destination input, fixed duration chips, interest tags, stats, and generate button.
- `components/explore/HeaderOverlay.vue`, `MapView.client.vue`, `QuickActions.vue`, `RoutePanel.vue`, and `RouteMarker.ts` violate the current kebab-case filename rule.
- `composables/useRouteGenerator.ts` is a module-level mock route generator with hard-coded Tokyo/Paris/fallback points. It should not become the long-term state boundary for AI.

### Existing Search and Data

- `server/api/search-locations.get.ts` uses Nominatim and `SearchLocationQuery`, but its query is under-validated and URL interpolation is unsafe.
- `components/app/search-locations.vue` demonstrates an existing explicit search/result-selection pattern, but Phase 2 needs live typeahead and better Explore UX.
- `stores/location.ts` and `lib/db/queries/location.ts` provide user-owned saved locations and location logs. They are the right source for saved-place and diary-log context, but context selection should be explicit and bounded.

### Verification Foundation

- Phase 1 added `test:server` with Node's built-in test runner and a scoped lint path.
- Global lint/typecheck are not clean. Phase 2 plans should verify focused files and new tests, and record if existing prototype filename blockers remain until renamed/replaced.

## Recommended Planning Shape

### Wave 1: Provider and Context Foundation

Build typed provider/search utilities, hardened fallback search, Mapbox suggest/retrieve endpoints or server utilities, and focused tests.

Requirements covered:
- EXPIN-01
- Partial EXPIN-04

### Wave 2: Explore Input UI

Refactor the Explore route panel and related components toward the design system. Add live city typeahead, trip duration, interests, and reusable filter state backed by the typed context boundary.

Requirements covered:
- EXPIN-01
- EXPIN-02
- EXPIN-03
- EXPIN-04

### Wave 3: Personal and Candidate Context

Add current-location opt-in, saved-place selection, diary-log selection, candidate/popular places, and the final typed request context object for Phase 3.

Requirements covered:
- EXPIN-04
- EXPIN-05

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Mapbox provider behavior changes or token restrictions block search. | Keep Nominatim fallback and isolate provider calls behind a typed normalization boundary. |
| Nominatim public service gets overused by live typeahead. | Debounce client input, minimum query length, cache normalized queries, and use it only as fallback. |
| UI work keeps prototype filenames and lint remains blocked. | Rename or replace Explore prototype files with kebab-case files during the UI plan. |
| Raw diary data leaks into future AI prompts. | Build a bounded `ExploreRequestContext` shape and explicit user selection before Phase 3. |
| Popular places imply fabricated popularity. | Label provider/app-derived candidates clearly and avoid community/popularity claims unless data supports them. |

## Open Decisions for Planner

- Exact endpoint naming for Mapbox suggest/retrieve and fallback search.
- Whether to keep a single `use-explore-context` composable or a Pinia `useExploreStore`.
- Exact design-system control shape for city autocomplete, day selector, interest chips, filters, and context selectors.
- Exact fallback behavior when Mapbox is unconfigured, denied, or rate limited.

## Sources

- Mapbox Search Box API: `https://docs.mapbox.com/api/search/search-box/`
- Mapbox Search JS Guides: `https://docs.mapbox.com/mapbox-search-js/guides/`
- Nominatim Search API: `https://nominatim.org/release-docs/latest/api/Search/`
- Nominatim Usage Policy: `https://operations.osmfoundation.org/policies/nominatim/`

---

*Phase: 2-Explore Inputs and Context Layer*
*Research complete: 2026-05-09*
