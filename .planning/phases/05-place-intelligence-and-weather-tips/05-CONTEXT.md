# Phase 5: Place Intelligence and Weather Tips - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 enriches the existing Explore route-viewing experience with rich generated-place popups and weather-aware route guidance. It adds photos, reviews, ratings, costs, app-community visit signals, best-effort likely/currently-there signals, and route preparation tips. It consumes route points, day grouping, distance metadata, and map/sidebar state from Phases 3 and 4, but does not own route generation, base map animation polish, or save-to-diary persistence.

</domain>

<decisions>
## Implementation Decisions

### Popup Content Shape

- **D-01:** Rich place popups should be photo-first. The first impression should be visual when a real provider-sourced or WanderLog app-owned place photo is available.
- **D-02:** Missing popup data should not collapse the UI or silently disappear. Show clear placeholders for missing photos, reviews, ratings, cost, or community signals.
- **D-03:** Place name, route rationale, actions, and practical details still belong in the popup, but should support the photo-first hierarchy rather than displacing it.

### Place Data and AI Enrichment

- **D-04:** Phase 5 may use external provider data for photos, reviews, ratings, and cost when provider data is available and safe to expose.
- **D-05:** AI-enriched summaries are allowed, but they should enrich available provider/app/route data rather than fabricate unsupported facts.
- **D-05a:** Place photos must be real media from provider or app-owned sources. AI-generated, stock-like, or illustrative fallback images must not be shown as place photos; use a missing-photo placeholder instead.
- **D-06:** Ratings, review snippets, cost levels, and AI summaries should carry source/confidence or degrade to placeholders when support is weak.
- **D-07:** Existing optional route cost fields from Phase 3 remain valid inputs, but Phase 5 should improve display and sourcing rather than treating cost as guaranteed.

### Community Visit Signals

- **D-08:** Use "likely/currently there" style community signals in v1 when app data supports a best-effort signal.
- **D-09:** Community presence must not be fabricated. If app data cannot support a likely/currently-there signal, show a missing-data placeholder or omit the specific claim.
- **D-10:** Visit counts should use existing WanderLog app data where available, such as saved locations and diary logs, and should remain clearly scoped to app-community data rather than real-world crowd truth.

### Weather Tips Placement

- **D-11:** Weather-aware route tips should live in the route sidebar, not primarily inside map popups.
- **D-12:** The sidebar should present practical preparation guidance: what to take, what to expect, and weather-related adjustments tied to the route/day context.
- **D-13:** Place popups may reference weather only when locally relevant, but the main route-wide weather guidance surface is the sidebar.

### the agent's Discretion

- The agent/planner may choose the exact popup layout, placeholder copy, provider boundary, data schema split, and weather provider integration as long as the popup is photo-first, photos are real provider/app media, missing data is explicit, AI enrichment is grounded in available data, and weather tips live in the sidebar.
- The agent/planner may choose exact labels for community signals, but the UI must communicate uncertainty for likely/currently-there signals and avoid presenting them as guaranteed live occupancy.
- The agent/planner may choose whether to persist enriched place intelligence or fetch/cache it best-effort, subject to provider terms, server-only credential handling, and privacy constraints.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Phase Scope

- `.planning/PROJECT.md` - Product direction, Explore MVP flow, provider-key/privacy constraints, and community-signal non-fabrication rule.
- `.planning/REQUIREMENTS.md` - Requirement IDs PLACE-01 through PLACE-06 and TIPS-01 through TIPS-02.
- `.planning/ROADMAP.md` - Phase 5 goal, success criteria, and v2 note that interactive audio history remains deferred.
- `.planning/STATE.md` - Current workflow state and resume information.
- `.planning/phases/01-explore-scope-and-verification-foundation/01-CONTEXT.md` - Locked Explore feature flow and place intelligence/weather scope.
- `.planning/phases/02-explore-inputs-and-context-layer/02-CONTEXT.md` - City/provider, candidate-place, filter, and explicit context-selection decisions.
- `.planning/phases/03-ai-route-generation-and-streaming/03-CONTEXT.md` - Route point contract, optional cost metadata, and AI output sourcing constraints.
- `.planning/phases/03-ai-route-generation-and-streaming/03-AI-SPEC.md` - AI route output/evaluation contract that Phase 5 must respect when enriching AI-generated places.
- `.planning/phases/03-ai-route-generation-and-streaming/03-HANDOFF.md` - Route event and route point field handoff to map/place rendering.
- `.planning/phases/04-animated-map-route-experience/04-CONTEXT.md` - Map-first route display, marker, day grouping, and popup handoff boundaries.

### Research and Codebase Map

- `.planning/research/FEATURES.md` - Explore map, AI route, place intelligence, weather tips, and v1/v2 framing.
- `.planning/research/SUMMARY.md` - Roadmap shape and warnings for provider integration, security, testing, and app-data boundaries.
- `.planning/codebase/STACK.md` - Current Nuxt, Nitro, Drizzle, Better Auth, Mapbox, Sentry, and verification stack.
- `.planning/codebase/ARCHITECTURE.md` - Existing client/server/data/integration layer patterns and authenticated API flow.
- `.planning/codebase/INTEGRATIONS.md` - Current Mapbox/Nominatim/S3/Sentry/provider patterns and Phase 3 AI route updates.
- `.planning/codebase/CONCERNS.md` - Map stack overlap, direct logging risk, test gaps, and warning against treating planned diagrams as implemented source.

### Existing Explore, Route, and App Data Source

- `components/explore/route-marker.ts` - Current marker and minimal popup HTML; likely replacement or expansion point for rich photo-first popups.
- `composables/use-mapbox.ts` - Mapbox marker/popup creation, route line, leg labels, fit, and lifecycle cleanup.
- `components/explore/route-panel.vue` - Current route sidebar where weather tips should live.
- `components/explore/route-distance-summary.vue` - Existing sidebar summary pattern that can inform weather-tip placement.
- `lib/ai/route-contract.ts` - Route point fields including rationale, confidence, distance, optional estimated price, price confidence, and price source.
- `lib/explore/route-map.ts` - Route map point and leg transforms consumed by marker, sidebar, and popup work.
- `lib/db/schema/ai-route.ts` - Persisted route point cost/source metadata and possible extension point for place intelligence metadata.
- `lib/db/queries/ai-route.ts` - User-owned AI route persistence and point ordering.
- `lib/db/schema/location.ts` - Existing saved-place data for app-community visit and saved-place signals.
- `lib/db/schema/location-log.ts` - Existing diary-log timestamps and coordinates that can support visit-count and recent-presence heuristics.
- `lib/db/schema/location-log-image.ts` - Existing user image metadata, relevant if app-owned photos are used in addition to provider photos.
- `lib/db/queries/explore-context.ts` - Existing bounded user-owned saved-place and diary-log context query pattern.
- `server/api/explore/candidate-places.get.ts` - Existing Mapbox Search Box candidate-place provider boundary and fallback behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `components/explore/route-marker.ts`: Creates current Mapbox marker elements and minimal popup HTML. Phase 5 should likely replace string-only popup HTML with a richer, safer photo-first rendering strategy or a typed popup renderer.
- `use-mapbox.ts`: Owns popup creation with Mapbox GL, marker lifecycle, route line rendering, and map cleanup. Rich popups must respect this module-level singleton and cleanup behavior.
- `route-panel.vue`: Natural home for sidebar weather tips because it already owns route controls, route stats, day selector, distance summary, warnings, errors, route history, and follow-up UI.
- `lib/ai/route-contract.ts`: Already carries optional estimated price metadata with confidence/source requirements. Phase 5 should build on this instead of inventing unsupported cost fields.
- `location`, `locationLog`, and `locationLogImage` schemas: Provide app-owned saved-place, visit timestamp, coordinate, and photo data that can support visit counts and limited community signals.
- `explore-context` query patterns: Demonstrate how to shape bounded, authenticated app data without leaking raw user history.

### Established Patterns

- Authenticated server APIs should use `utils/define-authenticated-handler.ts` and filter user-owned data by `event.context.user.id`.
- Inputs and provider responses should be validated with Zod before persistence or UI exposure.
- Provider credentials and sensitive config must remain server-only unless a provider explicitly supports public browser tokens.
- App data should be bounded and summarized before AI/provider use; raw diary payloads and sensitive location context should not be logged.
- Missing provider/app data should degrade gracefully. For Phase 5 this means explicit placeholders in the popup/sidebar rather than fabricated facts or AI/illustrative images.
- Existing verification includes focused server tests and Explore route-map tests; Phase 5 planning should add focused tests for enrichment shaping, missing-data placeholders, weather-tip correlation, and community-signal thresholds.

### Integration Points

- Rich popup data connects generated route points to provider place details, app-owned location/log data, and possibly AI-enriched summaries.
- Weather tips connect selected city/route/day context and route sidebar UI, likely through a server-side provider endpoint plus a client composable or route-session extension.
- Community visit and likely/currently-there signals connect to app-owned diary logs/saved places and must remain best-effort, scoped, and non-fabricated.
- Sentry/sanitized logging should observe provider failures without logging provider headers, secrets, prompts, raw personal context, or sensitive location history.

</code_context>

<specifics>
## Specific Ideas

- User wants place popups to be photo-first.
- User wants real photos for generated-route places, not AI-generated or illustrative image substitutes.
- User wants placeholders for missing data rather than empty or silently absent popup sections.
- User wants external/provider-backed place data and AI-enriched summaries.
- User wants likely/currently-there community signals, with the project constraint that these remain best-effort and app-data-supported.
- User wants weather tips in the route sidebar.

</specifics>

<deferred>
## Deferred Ideas

- Interactive audio history/storytelling remains v2 unless explicitly pulled forward later.
- Save generated routes or selected places into the diary belongs to Phase 6.
- Release hardening for provider observability, credential exposure, and cross-user access belongs to Phase 6, although Phase 5 must preserve those constraints while implementing.

</deferred>

---

*Phase: 5-Place Intelligence and Weather Tips*
*Context gathered: 2026-05-10*
