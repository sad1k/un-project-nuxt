# Phase 3 Handoff: AI Route Events to Phase 4 Map Rendering

## RouteEventEnvelope Contract

Phase 3 streams internal `RouteEventEnvelope` events from `server/api/ai/route.post.ts` to the Explore client. The client consumes these events through `composables/use-ai-route-session.ts` and stores route points by `variantId`.

Allowed event types:

- `route.session.created`
- `route.variant.started`
- `route.point.added`
- `route.point.updated`
- `route.variant.completed`
- `route.warning`
- `route.failed`

## Route Point Fields

Phase 4 should render map markers, route lines, day grouping, and animation from these route point fields:

- `id`
- `name`
- `day`
- `coordinates.lat`
- `coordinates.long`
- `estimatedStart`
- `estimatedDurationMinutes`
- `rationale`
- `confidence`
- `alternativeForPointId`
- `approximateDistanceMeters`
- `estimatedPriceLevel`
- `priceConfidence`
- `priceSource`

## What Phase 3 Delivers

- Authenticated route-generation request submission from Explore.
- Progressive client state for route events and route points.
- Route variant history with `activeVariantId` switching.
- Follow-up refinement input that preserves session history.
- Basic route point display and current map marker handoff using available coordinates.

## Deferred to Phase 4

Phase 4 owns the complete map rendering experience:

- Full marker design and marker state transitions.
- Route line rendering quality and path ordering.
- Day selection controls and day-by-day filtering.
- Map animation timing, camera choreography, and progressive reveal polish.
- Rich route leg visualization between points.

## Manual Browser Checks

Before Phase 4 planning, verify in the browser:

- Generate a route from Explore and confirm raw JSON is not visible.
- Confirm points appear as user-facing place names/rationale, not provider chunks.
- Submit a follow-up and confirm a new route variant is available.
- Switch route variants through the route history UI.
- Confirm failed provider credentials show a safe message instead of headers, prompts, or stack details.

## Known Operational Blocker

Remote Turso schema push remains blocked by HTTP 401 from Plan 03-01. Local Drizzle schema push succeeded against `file:local.db`, but remote schema verification must be repeated after credentials are fixed.
