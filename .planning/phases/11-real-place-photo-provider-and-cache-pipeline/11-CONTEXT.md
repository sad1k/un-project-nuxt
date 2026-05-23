# Phase 11: Real Place Photo Provider and Cache Pipeline - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>

## Phase Boundary

Phase 11 makes generated-route place photos reliable and honest. It does not add AI image generation or generic decorative imagery. It resolves real place photos from public WanderLog photos and configured provider/open-media sources, records cache metadata safely, and keeps explicit missing-photo states when no real photo is available.

</domain>

<decisions>

## Implementation Decisions

### Real Photo Policy

- **D-01:** Generated-route place photos must be real media. AI-generated, stock-like, or illustrative fallback images must not be shown as place photos.
- **D-02:** If no real photo is available, the product should show an explicit missing-photo state instead of fabricating visual content.
- **D-03:** `PlacePhoto` sources remain limited to provider or app-owned media.

### Source Priority

- **D-04:** Preferred source order is public WanderLog place photos -> Google Places Photos -> optional open/provider fallback such as Wikimedia or Foursquare -> missing-photo state.
- **D-05:** Public WanderLog photos are best when a safe place/coordinate match exists because they are real, app-owned/user-contributed media already under the app's visibility rules.
- **D-06:** Unsplash or generic stock imagery is not valid for `PLACE-02`/`REALPHOTO-*` because it usually represents a category or city mood rather than the exact place.

### Cache and Terms

- **D-07:** Cache normalized place-media metadata: source, provider place id, provider photo reference, attribution, terms/license hints, expiry, match confidence, and failure state.
- **D-08:** Do not permanently copy Google Places photo binaries into S3 unless provider terms explicitly allow it. Resolve fresh photo references server-side and use short-lived HTTP/browser caching.
- **D-09:** Durable S3/object storage is allowed for app-owned WanderLog photos and any future source whose license clearly permits copying.

### Security and Observability

- **D-10:** Provider credentials, photo references, provider headers, raw provider payloads, prompts, and private route context must stay server-only and out of logs.
- **D-11:** Provider/cache failures should be observable through sanitized failure codes and tests.

### the agent's Discretion

- The planner may choose exact table names, source enum names, match thresholds, TTL values, and whether Wikimedia/Foursquare lands in the first implementation slice or remains a typed optional adapter.
- The planner may choose whether the new media cache is a standalone table or a narrowly scoped extension of existing place intelligence code, as long as public/private boundaries and provider terms stay clear.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and Scope

- `.planning/PROJECT.md` - Product direction and real-photo decision.
- `.planning/REQUIREMENTS.md` - `REALPHOTO-*` requirements.
- `.planning/ROADMAP.md` - Phase 11 scope, dependencies, and success criteria.
- `.planning/phases/05-place-intelligence-and-weather-tips/05-CONTEXT.md` - Photo-first popup and missing-data decisions.
- `.planning/phases/10-traveler-place-photo-uploads-and-public-map-sharing/10-CONTEXT.md` - Public WanderLog photo visibility and privacy decisions.

### Existing Source

- `lib/explore/place-intelligence.ts` - `PlacePhoto` contract and missing slots.
- `lib/explore/place-intelligence-providers.ts` - Current Google Places provider adapter and photo reference shaping.
- `server/api/explore/place-photo.get.ts` - Current Google photo media proxy.
- `server/api/explore/place-intelligence.get.ts` - Current generated-route place enrichment endpoint.
- `lib/db/queries/location-log-image.ts` - Public WanderLog photo query patterns.
- `server/api/public/place-photos.get.ts` - Public photo API boundary.
- `components/explore/place-popup.ts` - Photo-first popup renderer.
- `composables/use-place-intelligence.ts` - Client cache for place intelligence responses.
- `lib/api-docs/openapi.ts` - API documentation definitions.

</canonical_refs>

<code_context>

## Existing Code Insights

- Phase 5 already has a place intelligence model, provider adapter, authenticated endpoint, photo proxy, photo-first popup renderer, and focused tests.
- Phase 10 already has private/public user photo visibility fields, public photo queries, a public photo API, and map-layer UI tests.
- The current Google provider resolves a first `places.photos[]` resource into `/api/explore/place-photo?name=...`, and the proxy streams Google media with short-lived private caching.
- `usePlaceIntelligence` currently caches by route variant and route point in client state, not in the database.
- The current system needs a stronger server-side media selection layer so public WanderLog photos can outrank provider photos and provider metadata can be cached safely.

</code_context>

<specifics>

## Specific Ideas

- Source order: public WanderLog photos first, Google Places second, Wikimedia/Foursquare optional fallback, missing-photo state last.
- Cache metadata and expiry, not permanent copies of provider photos when terms are uncertain.
- Keep attribution/license/source labels available to the UI.
- Do not add new dependencies casually; use native `fetch` and existing Drizzle/Nitro patterns.

</specifics>

<deferred>

## Deferred Ideas

- AI or generated illustrative imagery remains out of scope for place photos.
- Generic city/category background images can be considered later as decorative UI, but must not satisfy place-photo requirements.
- Full provider management UI remains out of scope.

</deferred>

---

*Phase: 11-real-place-photo-provider-and-cache-pipeline*
*Context gathered: 2026-05-22*
