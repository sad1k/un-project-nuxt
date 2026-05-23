# Phase 11: Real Place Photo Provider and Cache Pipeline - Research

**Researched:** 2026-05-22
**Status:** Ready for planning

## Summary

Phase 11 should add a small real-media layer between generated route points and popup rendering. The layer should choose photos in a deterministic order, cache only metadata and permitted assets, and return an explicit missing-photo state when no real media is available.

Recommended source order:

1. Public WanderLog place photos from Phase 10.
2. Google Places Photos through fresh server-side photo references.
3. Optional open/provider fallback such as Wikimedia Commons or Foursquare.
4. Missing-photo state.

## Provider Findings

### WanderLog Public Photos

Public WanderLog photos are the best first source because they are already app-owned/user-contributed media with explicit public visibility. They should be matched by bounded coordinates and normalized place name. The response must expose only public-safe fields already established in Phase 10: photo key/url, public place name, public coordinates, published date, and safe author display name.

### Google Places Photos

Google Places is the strongest MVP provider for real place photos because current code already fetches Google place details and photo resource names. The implementation should keep Google credentials server-only, fetch fresh details/photo names when needed, and stream media through the existing server endpoint with short-lived cache headers.

Do not assume Google photo resource names are permanent. Store provider place identity, selected photo metadata, attribution, and expiry; refresh references when stale.

Reference: https://developers.google.com/maps/documentation/places/web-service/place-photos

### Wikimedia Commons

Wikimedia Commons can be useful for landmarks, museums, monuments, parks, and other notable public places. It is weaker for small POIs. It can be implemented as an optional fallback by searching near coordinates and validating title/category/name similarity before accepting a result.

Reference: https://www.mediawiki.org/wiki/API:Geosearch

### Foursquare

Foursquare can be an optional configured fallback if Google is unavailable, too expensive, or incomplete in a region. It should follow the same adapter contract: server-only key, normalized photo metadata, attribution/source labeling, and no raw provider payload in UI/logs.

Reference: https://docs.foursquare.com/developer/reference/place-photos

### Unsplash

Unsplash should not satisfy place-photo requirements because search results are usually category/city mood images, not proof of the specific place. It may be useful later for decorative city backgrounds, but that is a different product surface.

Reference: https://unsplash.com/documentation

## Codebase Findings

- `lib/explore/place-intelligence.ts` already has `PlacePhoto`, missing slots, and source metadata.
- `lib/explore/place-intelligence-providers.ts` currently mixes Google rich fields and first-photo resolution. Phase 11 should split or wrap the photo-specific provider logic so real-photo selection is testable independently.
- `server/api/explore/place-photo.get.ts` currently proxies Google media by photo resource name. It should keep short-lived cache headers and avoid permanent storage.
- `lib/db/queries/location-log-image.ts` already lists public photos and can be extended with a nearest-place/photo query for generated route points.
- `server/api/public/place-photos.get.ts` is unauthenticated and privacy-filtered. Phase 11 should reuse its safe field assumptions, not feed private diary fields into Explore popups.
- `components/explore/place-popup.ts` already shows missing photo state when no `PlacePhoto` exists.

## Recommended Architecture

Add a `place-media` or `place-photo-resolution` module with:

- `resolveRealPlacePhoto(input)` as the public helper.
- Source adapters for app public photos and Google Places first.
- A typed optional adapter slot for Wikimedia/Foursquare.
- A cache query layer for metadata and stale/failure states.
- A strict result union: `photo | missing`, never illustrative.

The endpoint should call this helper before or during `buildPlaceIntelligence`, so the UI remains simple and still consumes `PlaceIntelligence.photo`.

## Risks

| Risk | Mitigation |
|------|------------|
| Provider terms accidentally violated by durable copying. | Store metadata/expiry by default; only copy app-owned or explicitly permitted assets. |
| Public photo matching shows the wrong user's photo for the wrong place. | Require bounded coordinate distance plus normalized name/category confidence before app photos outrank providers. |
| Google photo references expire or fail. | Cache expiry/failure state and refresh via place details before proxying media. |
| AI or stock imagery slips back in as a fallback. | Keep `PlacePhoto` source schema and tests restricted to provider/app sources. |
| Logs leak provider/private route data. | Use sanitized error codes and secret scans in verification. |

## Plan Shape

Create three plans:

1. Cache contract and metadata model.
2. Real-photo source chain and provider adapters.
3. Popup/API integration, docs, observability, and final verification.

## Verification Guidance

- Focused source tests for source order, cache expiry, no AI/illustrative photo source, and missing-photo behavior.
- API/source tests verifying server-only provider keys and no raw provider payloads.
- Existing place intelligence and popup tests should remain green.
- Manual browser verification should click generated-route popups with and without configured provider keys.

---

*Research complete for Phase 11*
