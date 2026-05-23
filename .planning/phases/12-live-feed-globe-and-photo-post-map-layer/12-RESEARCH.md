# Phase 12: Live Feed Globe and Photo Post Map Layer - Research

**Date:** 2026-05-22
**Status:** Complete

## Research Question

How should WanderLog connect public feed photo posts to a live Mapbox globe without leaking private diary data or making dense areas visually noisy?

## Existing App Evidence

- `post` already has a one-to-one relationship with `locationLogImage`, so feed posts can become globe posts without adding a new social-post table.
- `locationLogImage` already owns Phase 10 public snapshot fields: `visibility`, `publicPlaceName`, `publicLat`, `publicLong`, `publishedAt`, `moderationStatus`, `locationAccuracy`, and `locationSource`.
- `server/api/feed.get.ts` is public-friendly and uses `getFeedWithUserLikes`, but the current feed payload does not include public place name or coordinates.
- `server/api/posts/index.post.ts` is authenticated and owner-scoped through `createPost`, but it currently does not require that the image is intentionally public or coordinate-backed before becoming a globe-eligible post.
- `server/api/public/place-photos.get.ts` is already an unauthenticated safe public read boundary for public photos.
- `components/place-photo/public-photo-layer.client.vue` already renders public photo markers and popups, but it is static, marker-based, and lacks live/density behavior.
- `useMapbox.ts` initializes Mapbox with globe projection and fog, but it is shared route-map state; a dedicated feed globe component/composable should avoid interfering with Explore map lifecycle.

## External References

- Mapbox GL JS supports globe projection, with a documented globe guide and visual options such as fog/atmosphere for a global view: https://docs.mapbox.com/mapbox-gl-js/guides/globe/
- Mapbox GL JS supports GeoJSON source clustering, including point count display, through `GeoJSONSource` cluster options and cluster layers: https://docs.mapbox.com/mapbox-gl-js/example/cluster/
- MDN documents Server-Sent Events through `EventSource`, including server `text/event-stream` responses and automatic reconnect behavior: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- H3 exposes `createEventStream`, an app-friendly utility for server-sent event responses in Nitro/H3 handlers: https://www.h3.dev/utils/response

## Recommendation

Use the existing post/photo relationship as the source of truth, and add a dedicated public feed-globe API surface:

1. `POST /api/posts` remains the authenticated publish endpoint, but becomes stricter for public-globe eligibility:
   - image must belong to the current user;
   - image must be explicitly public;
   - image must have `publicLat`, `publicLong`, and `publicPlaceName`;
   - image must have visible moderation status;
   - duplicate image posts still return conflict.
2. Add a dedicated public read such as `GET /api/public/feed-globe` that returns only safe globe fields:
   - post id, created date;
   - image URL/alt;
   - public place name;
   - exact public coordinates;
   - public author display label/avatar if already public;
   - no diary description, private notes, raw image keys, provider internals, route context, email, auth ids, or ownership-only metadata.
3. Keep `/api/feed` useful for the normal list by enriching feed items with safe public place metadata when available, but do not make the list responsible for globe density/live semantics.
4. Implement a small pure density limiter before Mapbox rendering:
   - group points into local-radius buckets derived from coordinates and zoom-stable thresholds;
   - keep the newest 4 visible points per bucket;
   - expose hidden count per bucket for `+N`;
   - when a new point arrives in a full bucket, mark the oldest visible point as fading/removed and insert the newest one.
5. Render the feed globe with a dedicated client component:
   - Mapbox globe projection, fog, low-zoom spin;
   - GeoJSON source/layers for visible points and overflow indicators;
   - popup content limited to photo, place, author display name, and date;
   - no dependency additions.
6. Make "live" near-real-time:
   - prefer SSE using H3 `createEventStream` because the app already has streaming route-generation patterns and no dependency is needed;
   - include polling fallback when SSE fails or the browser does not support it;
   - keep the stream public but safe, emitting only the same public payload as `GET /api/public/feed-globe`.

## Risks And Mitigations

- **Private metadata leakage:** Solve with a dedicated serializer and tests that assert forbidden keys are absent from globe/feed public payloads.
- **Publishing non-public photos:** Solve by making `/api/posts` validate public visibility and public coordinate snapshots before accepting image-to-feed publishing.
- **Map state coupling:** Avoid reusing the singleton-style route-map composable directly for the globe tab unless the implementation isolates all lifecycle state.
- **Dense point clutter:** Keep density limiting pure and tested outside Mapbox, then feed Mapbox only the bounded visible/overflow result.
- **SSE runtime quirks:** Keep SSE additive with a simple polling fallback, and verify with server tests plus browser smoke checks.

## Plan Shape

- `12-01`: Public post/globe data contract, quick publish hardening, safe unauthenticated payload tests.
- `12-02`: Feed tab, Mapbox globe component, popup rendering, pure density limiter and UI tests.
- `12-03`: Live/near-live SSE plus polling fallback, OpenAPI docs, final verification artifact.

## RESEARCH COMPLETE

