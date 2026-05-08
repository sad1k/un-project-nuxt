# Phase 1: Explore Scope and Verification Foundation - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>

## Phase Boundary

Phase 1 delivers a locked feature contract and verification foundation for the fully working Explore page. It does not implement all Explore features yet; it makes the docs, phase plan, reusable template references, and verification gates clear enough that implementation phases can proceed without re-asking what Explore should become.

</domain>

<decisions>

## Implementation Decisions

### Core Explore Flow

- **D-01:** The target Explore flow is: enter city with autocomplete -> choose days/interests -> AI generates route -> route appears on map with animations -> save to diary.
- **D-02:** Explore is the primary surface for AI route planning, not a secondary dashboard widget.
- **D-03:** `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts` are template/prototype assets. Preserve their product intent, but the exact implementation and visuals may change.

### Map and Route Experience

- **D-04:** Generated routes need markers, route line, day-by-day route grouping, map animations, search, filters, current location, saved places, costs, and distances.
- **D-05:** Clicking a place should open a popup with place info, pictures, reviews, rating, cost, and distance when data is available.
- **D-06:** Popups should include app-community signals: how many WanderLog users visited the place and best-effort indication of how many users may be there at the current time, but only when supported by real app data or explicitly marked estimates.

### AI Behavior

- **D-07:** AI must generate routes.
- **D-08:** AI responses must stream text.
- **D-09:** AI should use the user's saved locations and diary logs as context.
- **D-10:** User must be able to ask follow-up questions to refine the route.
- **D-11:** AI output must include structured route data suitable for map rendering, not only prose.

### Weather, Tips, and Place Storytelling

- **D-12:** Explore should provide tips correlated with weather, especially what the user should take on the route.
- **D-13:** Interactive history/storytelling with sound is desired, but should be tracked as a later enhancement unless planning finds a small safe slice.
- **D-14:** Place pictures belong in the click popup and should use provider/app image data where available.

### Documentation

- **D-15:** Update all relevant planning docs for the Explore features: PROJECT, REQUIREMENTS, ROADMAP, research docs, and this phase context.
- **D-16:** Keep codebase map documents as current-state documentation; do not rewrite them to imply planned Explore features already exist.

### the agent's Discretion

- The agent/planner may choose exact UI layout, component boundaries, data provider APIs, and animation implementation details as long as the user-facing flow and feature list above are preserved.
- The agent/planner may stage expensive provider-backed features such as reviews, weather, photos, costs, and community presence across phases rather than forcing them all into Phase 1.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Scope

- `.planning/PROJECT.md` - Product direction and active Explore requirements.
- `.planning/REQUIREMENTS.md` - Requirement IDs and v1/v2 scope split.
- `.planning/ROADMAP.md` - Phase mapping and success criteria.
- `.planning/STATE.md` - Current phase and resume information.

### Research and Codebase Map

- `.planning/research/FEATURES.md` - Feature categories and v1/v2 framing.
- `.planning/research/SUMMARY.md` - Updated roadmap shape and implementation warnings.
- `.planning/codebase/STRUCTURE.md` - Where to add source files.
- `.planning/codebase/ARCHITECTURE.md` - Existing Nuxt/Nitro/Drizzle/client-server architecture.
- `.planning/codebase/CONCERNS.md` - Known risks, including AI/PWA not yet implemented and verification gaps.
- `.planning/codebase/TESTING.md` - Current absence of test framework.

### Existing Explore Template

- `components/explore/` - Visual/template direction for Explore page.
- `pages/explore.vue` - Existing Explore route entry.
- `composables/useRouteGenerator.ts` - Existing mocked route generator prototype.
- `composables/useMapbox.ts` - Existing Mapbox route/map behavior.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `components/explore/` - Use as product template/reference, not final locked implementation.
- `pages/explore.vue` - Current Explore page entry point.
- `composables/useRouteGenerator.ts` - Mock route generation should be replaced or wrapped by real AI-backed route generation.
- `composables/useMapbox.ts` - Existing markers, route line, fit-to-route, and map animation behavior can inform Phase 4.
- `stores/location.ts` and `stores/map.ts` - Existing saved location/map state patterns.
- `server/api/search-locations.get.ts` - Existing Nominatim-backed location search can inform city autocomplete.
- `lib/db/schema/location.ts`, `lib/db/schema/location-log.ts`, `lib/db/schema/location-log-image.ts` - Existing diary data structures for save-to-diary integration.

### Established Patterns

- Authenticated endpoints use `utils/define-authenticated-handler.ts`.
- Request validation uses Zod and Drizzle-generated schemas.
- User-owned data should always filter by `event.context.user.id` or equivalent `userId`.
- Provider credentials should be defined server-side in `lib/env.ts` and not exposed through public runtime config unless safe.

### Integration Points

- Explore inputs connect to Nominatim/search and saved locations.
- AI route generation connects to future `server/api/ai/**` endpoint and Drizzle AI tables.
- Map route display connects to `composables/useMapbox.ts` and existing map adapter patterns.
- Save-to-diary connects to `server/api/locations**` and `lib/db/queries/location*.ts`.

</code_context>

<specifics>

## Specific Ideas

- City input must support autocomplete.
- User chooses days and interests before generation.
- AI-generated route should appear on the map with animations.
- Map must support markers, route line, day-by-day route grouping, search, filters, current location, saved places, costs, distance display, and place popups.
- Place popup should show reviews/rating, photos, info, and community visit/current-time signals.
- Weather-aware tips should tell the user what to take on the route.
- Interactive place history with sound is desired.
- Generated route should be saveable to the diary.

</specifics>

<deferred>

## Deferred Ideas

- Full interactive audio history/storytelling pipeline belongs after place popups and provider/data decisions are stable.
- Push notifications remain a later PWA/notifications phase.
- Guaranteed live place presence is not in scope unless a real data source exists.

</deferred>

---

*Phase: 1-Explore Scope and Verification Foundation*
*Context gathered: 2026-05-08*
