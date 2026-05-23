# Phase 10: Traveler Place Photo Uploads and Public Map Sharing - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers a traveler-facing, mobile-first place photo contribution flow. An authenticated traveler can quickly take a photo, attach it to a place using their current GPS position, confirm or adjust the map marker, save the result as a normal private diary record, and later explicitly make that photo public. Public photos appear in place/map surfaces for everyone, including unauthenticated visitors where the map/page itself is public.

This phase owns camera-first capture, GPS/manual marker confirmation, nearest-place confirmation, private diary persistence, explicit public visibility, public map/photo display, owner unpublish/delete behavior, and privacy-safe public reads. It does not add a full moderation queue, admin moderation UI, public captions, feed-first publishing, or a separate public photo social product.

</domain>

<decisions>
## Implementation Decisions

### Photo Source And Place Attachment
- **D-01:** Phase 10 should build a new quick flow where a traveler can take a photo and add the place through a GPS marker.
- **D-02:** The quick GPS photo flow should create full personal diary records: `location`, `locationLog`, and `locationLogImage`.
- **D-03:** The app should use nearest-place search from the GPS coordinates, then let the user confirm or rename the attraction/place before saving.
- **D-04:** The first version should be camera-first on mobile, with gallery/file picker fallback.
- **D-05:** Phase 10 is not limited to publishing existing diary images; the core experience is "take photo now, attach place now."

### Map Placement Experience
- **D-06:** After the user takes a photo, the app should immediately place a marker at the user's current geolocation and show a confirmation step.
- **D-07:** Saving requires an explicit map confirmation screen with a draggable marker before creating the diary records.
- **D-08:** If browser geolocation is unavailable or inaccurate, the app should provide manual placement through map/search fallback.
- **D-09:** The UI should show a location accuracy state, such as precise, approximate, or manual, with radius/text when available.
- **D-10:** Phase 10 should not save a place photo without coordinates because the existing diary `location` and `locationLog` model requires coordinates.

### Public Sharing Surface
- **D-11:** The first public sharing surface should be place/map surfaces, not feed-first publishing.
- **D-12:** Public photos should appear through a separate public photos map layer with distinct photo markers or clustering, separate from personal diary markers.
- **D-13:** Public photos should be visible to all app users, including unauthenticated visitors on public pages/maps.
- **D-14:** Public photo popups/galleries should show only photo, place, author display name, and date.
- **D-15:** Public photo surfaces must not expose private diary descriptions, private location notes, hidden route/diary context, or private user metadata.

### Visibility And Removal Model
- **D-16:** Public visibility should be modeled as visibility/public metadata fields on `locationLogImage`, not as a separate public photo table and not by reusing existing `post` as the primary model.
- **D-17:** Photos are private by default. Public sharing happens later through a separate explicit "Make public" toggle/action.
- **D-18:** Making a public photo private again removes it from the public layer but keeps the owner's diary image.
- **D-19:** Public map/gallery reads should use snapshot-safe fields such as `publicPlaceName`, `publicLat`, `publicLong`, `publishedAt`, `visibility`, and `moderationStatus`.
- **D-20:** Private diary fields should remain private; changes to private diary text should not unexpectedly change the public map surface.

### Moderation And Safety Boundary
- **D-21:** Phase 10 should include owner controls plus hidden moderation fields: owner can unpublish/delete, and the model stores `moderationStatus` for future admin/moderation workflows.
- **D-22:** Phase 10 should not build full admin moderation UI, user reporting, moderation queue, reason codes, or audit trail unless a later plan explicitly expands the scope.
- **D-23:** Public captions/descriptions are out of scope for Phase 10; public cards show only photo, place, author display name, and date.
- **D-24:** Deleting the underlying diary image/log/location should remove the photo from public map surfaces through cascade or equivalent visibility cleanup.
- **D-25:** Public photo reads may be unauthenticated on public pages, but upload, save, publish, unpublish, and delete require authentication and owner checks.

### the agent's Discretion
- The planner may choose exact route/page names for the quick capture flow and public map layer as long as the flow remains camera-first, GPS-confirmed, and private by default.
- The planner may choose the exact schema field names and enum values for visibility, accuracy, and moderation status, provided the public snapshot/private diary split is preserved.
- The planner may choose whether the nearest-place lookup reuses existing Mapbox/Nominatim search endpoints or adds a focused nearby-place endpoint, provided provider keys remain safe and the user can confirm or rename the result.
- The planner may decide whether clustering is implemented in the first public photo map slice or staged behind a simple bounded marker layer, provided public photos remain visually separate from personal diary markers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product And Phase Scope
- `.planning/PROJECT.md` - Product direction, privacy constraints, existing image/S3/map/feed capabilities, and Phase 10 contribution intent.
- `.planning/REQUIREMENTS.md` - `PHOTO-01` through `PHOTO-06` and traceability for traveler place photo sharing.
- `.planning/ROADMAP.md` - Phase 10 goal, success criteria, constraints, and dependency on Phase 9.
- `.planning/STATE.md` - Current GSD workflow state and release blockers from earlier phases.

### Prior Decisions
- `.planning/phases/05-place-intelligence-and-weather-tips/05-CONTEXT.md` - Photo-first place popup behavior, app/community signal constraints, provider-data fallback, and non-fabrication rules.
- `.planning/phases/06-save-to-diary-and-release-hardening/06-CONTEXT.md` - Reuse of existing `location` and `locationLog`, automatic diary persistence, ownership, credential, and observability constraints.
- `.planning/phases/07-add-advanced-place-storytelling-and-audio-narration/07-CONTEXT.md` - Explicit-user-action boundary, provider credential safety, and route/place generated-content privacy constraints.
- `.planning/phases/09-admin-route-generation-observability-and-improvement-loop/09-CONTEXT.md` - Admin role/privacy constraints and evidence that full moderation/admin surfaces should be explicit, scoped work.

### Codebase Maps
- `.planning/codebase/STACK.md` - Nuxt, Nitro, Vue, Drizzle, Better Auth, S3, map, and testing stack.
- `.planning/codebase/ARCHITECTURE.md` - Authenticated API, Drizzle query layer, location/image upload flow, feed flow, and map abstractions.
- `.planning/codebase/CONVENTIONS.md` - Kebab-case files, authenticated handler patterns, validation conventions, and UI/API style.

### Source Integration Points
- `lib/db/schema/location.ts` - Existing user-owned place schema, coordinates, slug/name uniqueness, and insert validation.
- `lib/db/schema/location-log.ts` - Existing diary log schema with required coordinates and user/location ownership.
- `lib/db/schema/location-log-image.ts` - Existing image metadata table that Phase 10 should extend with visibility/public snapshot fields.
- `lib/db/schema/post.ts` - Existing feed post model; relevant as a contrast because Phase 10 should not make feed posts the primary public map model.
- `lib/db/queries/location.ts` - Ownership-safe location, log, and image delete patterns plus route-point find/create precedent.
- `lib/db/queries/location-log-image.ts` - Existing image metadata insert path.
- `lib/db/queries/post.ts` - Existing public feed/image query patterns and `isPosted` precedent.
- `server/api/locations/[slug]/[id]/sign-images.post.ts` - Existing presigned S3 upload flow, metadata checks, and size constraints to reuse or adapt.
- `server/api/locations/[slug]/[id]/image.post.ts` - Existing S3 metadata verification and diary image insert flow.
- `server/api/locations/[slug]/[id]/images/[image-id].delete.ts` - Existing owner-scoped image delete and S3 object delete behavior.
- `server/api/posts/my-images.get.ts` - Existing user-owned image list for publishing.
- `server/api/posts/index.post.ts` - Existing authenticated publish action and uniqueness conflict pattern.
- `components/file-upload.vue` - Existing upload component, useful as a fallback but Phase 10 needs camera-first behavior.
- `pages/dashboard/location/[slug]/[id]/images.vue` - Existing client-side image resize/hash/upload flow.
- `pages/dashboard/publish.vue` - Existing image publish UI; relevant as precedent, not the primary Phase 10 flow.
- `components/app/map.client.vue` - Existing MapLibre marker and draggable added-point behavior.
- `stores/map.ts` - Existing map point state and marker/fly-to patterns.
- `components/explore/map-view.client.vue` - Existing Explore Mapbox shell for route maps.
- `composables/use-mapbox.ts` - Existing route marker, popup, route line, and map lifecycle logic.
- `server/api/explore/city-suggest.get.ts` - Existing Mapbox/Nominatim search boundary and safe public-token handling.
- `server/api/explore/candidate-places.get.ts` - Existing provider-backed place suggestion pattern that may inform nearest-place lookup.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `location`, `locationLog`, and `locationLogImage`: The core private diary path already represents a place, a visit/log, and one or more images. Phase 10 should extend this path instead of creating a parallel media product first.
- Existing S3 upload endpoints: `sign-images.post.ts` signs user/log-scoped object keys, and `image.post.ts` verifies S3 metadata before inserting image metadata. This is the right storage precedent for quick capture uploads.
- `components/app/map.client.vue`: Already supports a draggable `mapStore.addedPoint` marker and double-click marker updates; this is a strong precedent for the required confirmation step.
- Existing post/feed flow: `pages/dashboard/publish.vue`, `post.ts`, and `post.ts` queries show how the app currently turns a diary image into public content, but Phase 10 should keep public map visibility independent from feed posts.
- Mapbox/Nominatim search endpoints: Existing Explore city/candidate-place provider boundaries can inform nearest-place lookup from GPS coordinates.

### Established Patterns
- Mutating endpoints should use `defineAuthenticatedHandler` and enforce ownership in query helpers with `userId`.
- New request bodies and query params should be validated with Zod or Drizzle-generated schemas.
- Provider credentials and private diary data must stay server-side and out of public runtime config/logs.
- Public views should be driven by explicitly safe serialized fields, not by dumping full private diary records.
- New source files should use kebab-case and follow existing Nuxt page/API route conventions.

### Integration Points
- Add or adapt a quick camera capture page/component that asks for geolocation, captures/selects an image, confirms a draggable marker, resolves nearby place suggestions, and creates `location` + `locationLog` + `locationLogImage`.
- Extend `locationLogImage` with public visibility, public place snapshot, public coordinate snapshot, publish timestamp, accuracy/source metadata, and moderation status.
- Add owner-only endpoints/actions for making a diary image public/private and deleting/removing public visibility.
- Add public read endpoint(s) for public photo map markers/galleries that return only safe fields and exclude hidden/private/moderated items.
- Add a map layer/component for public photo markers or clusters, separate from personal diary markers.
- Add focused tests for unauthenticated public reads, authenticated owner writes, cross-user publish/unpublish denial, no private diary text in public payloads, cascade visibility removal, and location accuracy/manual placement handling.

</code_context>

<specifics>
## Specific Ideas

- The desired traveler flow is: open app, quickly take a photo, use GPS as the initial marker, confirm or drag the marker, choose/rename the nearest place, save it to the diary, then optionally make the photo public later.
- The public map should feel like a community place-photo layer, not like the user's private diary map.
- Public photo cards should stay intentionally lean: image, public place name, author display name, and date only.
- Accuracy feedback matters because public map markers should feel trustworthy and editable rather than mysteriously wrong.

</specifics>

<deferred>
## Deferred Ideas

- Publishing existing diary photos as an alternate entry path is deferred unless planning can include it without weakening the camera-first scope.
- Feed-first public sharing and automatic feed post creation are deferred; Phase 10 public sharing is map/place-first.
- Public captions, story text, or diary-description reuse are deferred because they expand moderation and privacy risk.
- Full admin moderation UI, report flow, moderation queue, reason codes, and audit trail are deferred to a future moderation/admin phase.
- A standalone public web gallery beyond the public map/place surfaces is deferred.

</deferred>

---

*Phase: 10-Traveler Place Photo Uploads and Public Map Sharing*
*Context gathered: 2026-05-20*
