# Phase 10 Research: Traveler Place Photo Uploads and Public Map Sharing

**Researched:** 2026-05-20
**Status:** Complete

## Summary

Phase 10 should extend WanderLog's existing diary image model instead of creating a parallel public-media system. The safest implementation path is:

1. Add public visibility and snapshot-safe public fields to `locationLogImage`.
2. Add focused query helpers and endpoints for owner publish/unpublish plus public read-only map/gallery payloads.
3. Build a camera-first quick capture flow that creates normal private diary records first.
4. Add a distinct public-photo map layer that reads only public-safe fields.

This keeps private diary ownership, S3 image storage, and map placement aligned with the current app architecture while avoiding feed-first semantics.

## Existing Code Findings

### Data Model

- `lib/db/schema/location.ts` stores user-owned places with required `lat` and `long`.
- `lib/db/schema/location-log.ts` stores user-owned diary logs with required coordinates and a required `locationId`.
- `lib/db/schema/location-log-image.ts` stores user-owned images with `key`, `description`, `locationLogId`, and `userId`.
- `locationLogImage` is the right extension point for `visibility`, public snapshot fields, publish timestamp, location accuracy/source metadata, and hidden moderation status because public sharing is a visibility layer on a diary image.
- `lib/db/schema/post.ts` already turns a diary image into public feed content, but Phase 10 decisions explicitly reject feed-first publishing as the primary public map model.

### Upload And Storage

- `server/api/locations/[slug]/[id]/sign-images.post.ts` signs direct S3 uploads with a user/log scoped key and validates content length/checksum.
- `server/api/locations/[slug]/[id]/image.post.ts` verifies S3 metadata before inserting `locationLogImage`.
- `pages/dashboard/location/[slug]/[id]/images.vue` already performs client-side image resize/hash/upload, but it contains page-specific logic and console logging; Phase 10 should extract/reuse the pattern rather than copy it wholesale.
- Current upload key validation only accepts `.jpg`, while the client converts to `image/png` before uploading under a `.jpg` key. Planning should include fixing or preserving behavior deliberately, not expanding the mismatch.

### Map And GPS

- `components/app/map.client.vue` already supports a draggable `mapStore.addedPoint` marker and double-click coordinate updates.
- `stores/map.ts` exposes `addedPoint`, `mapPoints`, and `flyToPoint`; a quick capture confirmation flow can reuse or adapt this.
- `components/explore/map-view.client.vue` and `composables/use-mapbox.ts` own the Explore route map and Mapbox marker/popup lifecycle. Public photo markers can be added as a separate layer/component, but they must stay distinct from private diary markers.

### Public Sharing And Privacy

- Existing feed queries expose image key, description, user display info, likes, and comments. Phase 10 public photo queries should be stricter: public place name, public coordinates, author display name, date, and image URL/key only.
- Existing authenticated endpoints generally use `defineAuthenticatedHandler` and query-level `userId` filters. Owner mutation endpoints for publish/unpublish/delete should keep this pattern.
- Public read endpoints must avoid `defineAuthenticatedHandler`, but should be allowlist-only and exclude private fields such as diary description, private location/log names if snapshot fields are absent, raw S3 metadata, and any hidden moderation/internal state beyond filtering.

## Browser/API Research

- MDN documents `capture` as a file-input attribute for requesting camera capture, including `environment` for the outward-facing camera, but marks it limited availability. Therefore Phase 10 should treat `capture="environment"` as progressive enhancement with file/gallery fallback, not as a guaranteed camera API.
- MDN documents `accept="image/*"` as a file input hint, not validation. Server-side validation remains required.
- MDN documents Geolocation as permission-gated, secure-context-only, and available through `navigator.geolocation.getCurrentPosition()` / `watchPosition()`. It returns coordinates and accuracy through `GeolocationPosition`.
- MDN documents the Permissions API as a way to query permission state such as `geolocation`, but access still depends on browser support, secure context, permissions policy, and user choice. Phase 10 should query when useful and still handle denial/error manually.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API

## Recommended Plan Shape

### Wave 1: Data And API Foundation

Build schema/query/API foundations before UI:

- Extend `locationLogImage` with public visibility and snapshot fields.
- Add owner-scoped publish/unpublish helpers.
- Add public read helpers for map markers/galleries.
- Add tests proving default-private behavior, public-safe payloads, owner-only writes, and unauthenticated public reads.

### Wave 2: Quick Camera/GPS Private Save Flow

Build the private diary capture flow:

- Create camera-first file input with `accept="image/*"` and `capture="environment"`.
- Add geolocation request, accuracy state, and manual fallback.
- Add nearest-place suggestions from GPS coordinates using existing provider patterns or a focused nearby-place endpoint.
- Save `location` + `locationLog` + image privately first.

### Wave 3: Public Map Layer And Owner Controls

Expose public sharing:

- Add "Make public" / "Make private" owner action.
- Add public photo map layer and popup/gallery UI.
- Add final privacy/security verification and release artifact.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Public endpoint leaks private diary text. | Use explicit serializers and source tests that forbid private fields. |
| Camera capture fails on some browsers. | Treat `capture` as enhancement and keep gallery fallback. |
| GPS denied or inaccurate. | Manual map/search fallback and visible accuracy state. |
| Public map mixes personal diary markers with community photos. | Separate public photo layer with distinct marker styling/clustering. |
| Schema fields are added without migration/test coverage. | Add source tests and record local schema rollout/manual verification in final plan. |
| Existing upload MIME/key mismatch causes confusing behavior. | Plan should explicitly inspect and either preserve with tests or normalize image type/key validation. |

## Verification Guidance

Use the existing focused `node:test` style:

- Schema/source tests for `locationLogImage` public fields and defaults.
- Query/API tests for public read allowlist and owner-only writes.
- UI source tests for camera input attributes, geolocation fallback, confirmation marker, and public map layer.
- Existing commands: `node scripts/run-node-tests.mjs ...`, `pnpm test:server`, `pnpm lint:source`, `pnpm typecheck`, `pnpm build`.

Manual browser checks should include mobile viewport/camera fallback, geolocation denied, geolocation approximate, marker drag, private save, public publish, unauthenticated public map visibility, and owner unpublish.

## Open Questions For Planning

No user-blocking questions remain. The planner may choose exact route names, schema enum values, endpoint names, and whether clustering is first-slice or follow-up, subject to the decisions in `10-CONTEXT.md`.

## RESEARCH COMPLETE
