# Phase 5: Place Intelligence and Weather Tips - Research

**Researched:** 2026-05-10
**Status:** Complete

## Scope

Phase 5 enriches generated Explore route points with rich place intelligence and weather-aware preparation guidance. The implementation must preserve the route/map contracts from Phases 3 and 4 while adding photo-first popups, missing-data placeholders, provider/app/AI-enriched place data, app-community visit and likely/currently-there signals, and sidebar weather tips.

## Official Provider Findings

### Mapbox Search Box

- Mapbox Search Box remains the right existing provider for city/POI identity, coordinates, formatted address context, categories, and retrieve-by-`mapbox_id` behavior.
- The `/suggest` and `/retrieve` endpoints are designed as a paired interactive search session; retrieve returns detailed feature properties including point geometry, name, feature type, address/full address, `place_formatted`, context, POI categories, external IDs, and metadata.
- Mapbox Search Box should not be treated as the sole rich-place provider for this phase because the official Search Box data model is oriented around search/geocoding fields, not guaranteed photos, user reviews, ratings, or price details.

### Google Places

- Google Places API (New) is the best documented optional provider for Phase 5 rich place fields. Place Details can return comprehensive place information such as address, phone, user rating, and reviews.
- Google Places field masks matter. Production requests should ask only for the fields needed for the popup to control response size and billing; do not use wildcard field masks outside development.
- Google Place data fields include rich properties relevant to Phase 5, including `photos`, `rating`, `reviews`, `priceLevel`, and `generativeSummary`.
- Place Photos (New) returns photo media from photo resource names produced by Place Details, Nearby Search, or Text Search. The photo request requires `maxHeightPx`, `maxWidthPx`, or both.
- Google Places should be optional-at-boot, server-only, and feature-detected through env/config. The app must still render placeholders and route/app data when the provider key is absent or the provider returns partial data.

### Open-Meteo

- Open-Meteo Forecast API is a good first weather provider for this phase because it accepts latitude/longitude and exposes hourly/daily forecast variables over HTTP without a new SDK.
- The `/v1/forecast` endpoint accepts WGS84 `latitude` and `longitude`, returns JSON, and supports hourly variables such as `temperature_2m`, `apparent_temperature`, `precipitation_probability`, `weather_code`, and wind variables.
- Daily forecast fields include daily min/max temperature, apparent temperature, precipitation sum/probability, weather code, sunrise/sunset, and related aggregates.
- Open-Meteo defaults to a 7-day forecast and can return up to 16 forecast days, which aligns with the route contract's 1-14 day trip duration.

## Local Code Findings

### Place Popup Surface

- `components/explore/route-marker.ts` currently builds popup HTML as a string with day, name, and marker kind only. Phase 5 should replace this with a typed renderer that escapes user/provider text and can render a photo-first layout plus missing-data placeholders.
- `composables/use-mapbox.ts` creates Mapbox GL popups and controls marker lifecycle. Rich popup work must keep cleanup explicit and avoid leaking event listeners during route redraws.
- `lib/explore/route-map.ts` carries route display fields but not provider place intelligence. Phase 5 should add a separate place-intelligence model instead of bloating the route-map helper.

### Existing Data for Community Signals

- `location` and `locationLog` provide app-owned saved place coordinates and visit timestamps. They can support visit counts and a best-effort recent-presence/likely-there signal without exposing user identities.
- Community visit signals should aggregate app data only. The UI must say or imply "WanderLog signal" rather than real-world crowd truth.
- A reasonable first heuristic is coordinate/name proximity plus a recent time window. The exact threshold can be planner/executor discretion, but the model must expose confidence and avoid claims when support is weak.

### Existing Data for Cost and AI Enrichment

- `lib/ai/route-contract.ts` already includes optional `estimatedPriceLevel`, `priceConfidence`, and `priceSource`.
- Phase 5 should treat route-provided price as one source among provider/app/AI-enriched data, not as guaranteed truth.
- Existing `lib/ai/openai-compatible.ts` can be reused for grounded AI summaries if planning chooses to extend the adapter, but summaries should be generated from selected provider/app/route fields only and should never add unsupported claims.

### Sidebar Weather Surface

- `components/explore/route-panel.vue` is already the route control and summary surface. Weather tips should be added there as a compact sidebar section near route stats/distance.
- `components/explore/route-distance-summary.vue` is a useful pattern for a small data-driven sidebar component with unavailable states.
- Weather tip generation is best modeled as a pure helper plus an authenticated server endpoint: forecast input/output can be tested without browser or provider credentials, and the sidebar can consume a composable.

## Recommended Implementation Shape

1. Add a typed place-intelligence model and endpoint first.
   - Define fields for photos, rating, review snippets, cost, AI summary, community visits, likely/currently-there signal, missing-data slots, and source/confidence metadata.
   - Add provider adapters behind native `fetch`: Google Places when configured, Mapbox/app/route fallback otherwise.
   - Add aggregate app-community query helpers that return counts/signals without user identities.

2. Upgrade the Mapbox popup renderer.
   - Add a client composable for fetching place intelligence for selected route points.
   - Render photo-first popup HTML with missing-data placeholders.
   - Keep route marker interactions stable and avoid raw JSON/provider payloads in the UI.

3. Add weather tips to the route sidebar.
   - Add Open-Meteo-backed server endpoint using route/city coordinates and selected days.
   - Add a pure weather-tip mapper for rain, heat/cold, wind, UV/sunlight where available, and generic "what to take" guidance.
   - Render tips in `route-panel.vue`, grouped by route/day as appropriate.

4. Verify with focused tests before manual browser review.
   - Test model shaping, provider fallback behavior, missing-data slots, no fabricated presence, and weather-tip correlation.
   - Run `pnpm test:server`, `pnpm lint:source`, and `pnpm typecheck`.
   - Finish with a browser check of `/explore` popup and sidebar behavior.

## Risks and Mitigations

- **Provider availability:** Google Places may be unconfigured locally. Make the provider optional and render meaningful missing-data placeholders.
- **Provider cost and field masks:** Use explicit field masks; avoid wildcard responses in production code.
- **AI hallucination risk:** Generate AI summaries only from available route/provider/app facts and label/source them as AI-enriched.
- **Community privacy:** Aggregate counts/signals only. Do not expose user identities, diary text, or raw visit history.
- **False live-presence claims:** Use confidence, recent-window labels, and missing-data states; never show likely/currently-there without app data support.
- **Mapbox popup safety:** Escape provider/user text before putting it into popup HTML.
- **Weather overpromising:** Weather forecasts are best-effort. Tips should say "prepare for" and map to forecast confidence/availability rather than absolute guarantees.

## Sources

- Google Places API Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
- Google Places API Place Data Fields (New): https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Places API Place Photos (New): https://developers.google.com/maps/documentation/places/web-service/place-photos
- Open-Meteo Forecast API docs: https://open-meteo.com/en/docs
- Mapbox Search Box API docs: https://docs.mapbox.com/api/search/search-box/

## Research Complete

Planner should create three plans: a server/data contract plan for place intelligence, a UI plan for photo-first popups, and a weather/sidebar plan for route preparation tips. The popup UI plan depends on the place intelligence endpoint. The weather/sidebar plan can proceed independently but should finish with integrated Explore verification.
