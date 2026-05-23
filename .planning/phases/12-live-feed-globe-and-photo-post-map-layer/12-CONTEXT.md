# Phase 12: Live Feed Globe and Photo Post Map Layer - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 delivers a social discovery layer that connects the existing feed, public place photos, and Mapbox globe experience. Authenticated users get a faster way to publish an uploaded/public place photo into the feed, and the feed gains a tab that opens a global, public Mapbox globe where public photo posts appear as live/near-live animated points.

This phase owns quick feed publishing, feed-tab navigation to the globe, public post coordinate payloads, live/near-live point updates, bounded dense-radius display, and privacy-safe popup content. It does not add a new moderation system, private diary sharing, guaranteed live crowd presence, direct messaging, notifications, or a standalone social network beyond feed/photo-map discovery.

</domain>

<decisions>
## Implementation Decisions

### Phase Placement And Product Shape
- **D-01:** This is a new Phase 12, not a retrofit into Phase 10 or Phase 11.
- **D-02:** The feature should unite the feed and Mapbox into a social discovery experience: a live feed plus a separate tab for a wow-effect global globe view of created photo posts.
- **D-03:** The globe should show created public photo posts, not arbitrary private diary images.

### Publishing Flow
- **D-04:** A user should have a quick button/action for publishing an uploaded place photo to the feed.
- **D-05:** Publishing remains an explicit authenticated action; the user chooses to share the photo into the feed rather than every public place photo automatically becoming a feed post.
- **D-06:** The planner should reuse the existing post/feed and public photo primitives where possible instead of creating an unrelated social-post model.

### Globe Visibility And Data
- **D-07:** The globe tab should be visible to everyone, including unauthenticated visitors.
- **D-08:** Only public photo posts appear on the globe, so exact public coordinates are acceptable.
- **D-09:** Public globe payloads must expose only safe intentional metadata: photo, place, author display name, date, and coordinates needed to render the point.

### Live Point Behavior
- **D-10:** The globe should feel live: newly created public photo posts should appear online/near-real-time as animated points.
- **D-11:** Dense locations should be bounded visually. In one local radius, show no more than 3-4 active points.
- **D-12:** If a new post appears in an already-full local radius, the oldest visible point should disappear or fade out so the newest point can appear.
- **D-13:** Hidden dense-area posts should still have a clear overflow indication such as a small `+N` counter.

### Popup Content
- **D-14:** A point popup should show photo, place, author display name, and date.
- **D-15:** Popup content should not include private diary descriptions, private notes, hidden route context, provider internals, or private user metadata.

### the agent's Discretion
- The planner may choose whether live/near-live updates use SSE, polling, or an existing app-friendly update mechanism, provided the experience feels live and does not add a new runtime dependency casually.
- The planner may choose the exact tab labels and route/component names, provided the feed keeps its normal list and gains a clear globe tab.
- The planner may choose the local-radius algorithm and threshold units for density limiting, provided the user-facing behavior is max 3-4 active points per radius plus overflow.
- The planner may decide whether the globe reuses `useMapbox` directly or extracts a dedicated feed-globe composable, provided existing Mapbox token/privacy boundaries are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product And Phase Scope
- `.planning/PROJECT.md` - Product direction, existing feed/photo/map capability, privacy constraints, and Phase 12 social discovery intent.
- `.planning/REQUIREMENTS.md` - `LIVEGLOBE-01` through `LIVEGLOBE-06` and traceability for the new live feed globe phase.
- `.planning/ROADMAP.md` - Phase 12 goal, success criteria, constraints, and dependency on Phases 10 and 11.
- `.planning/STATE.md` - Current GSD workflow state and release blockers from prior phases.

### Prior Decisions
- `.planning/phases/10-traveler-place-photo-uploads-and-public-map-sharing/10-CONTEXT.md` - Public place photo visibility, exact/user-confirmed coordinates, safe public metadata, and owner controls.
- `.planning/phases/10-traveler-place-photo-uploads-and-public-map-sharing/10-VERIFICATION.md` - Existing public photo API/layer verification and remaining manual browser risks.
- `.planning/phases/11-real-place-photo-provider-and-cache-pipeline/11-CONTEXT.md` - Real media only, provider/privacy boundaries, and public WanderLog photo source precedence.
- `.planning/phases/11-real-place-photo-provider-and-cache-pipeline/11-VERIFICATION.md` - Current real-photo release blockers and verification expectations.

### Codebase Maps
- `.planning/codebase/STACK.md` - Nuxt, Nitro, Vue, Pinia, Drizzle, S3, Mapbox/MapLibre, and testing stack.
- `.planning/codebase/ARCHITECTURE.md` - Feed, image upload, database query, public read, and map integration patterns.
- `.planning/codebase/CONVENTIONS.md` - Authenticated handler, validation, kebab-case, and UI/API style conventions.

### Source Integration Points
- `pages/feed.vue` - Existing feed page, list loading, tab precedent, and publish entry point.
- `stores/feed.ts` - Existing feed store, pagination, optimistic like behavior, and `FeedPost` shape.
- `components/feed/post-card.vue` - Existing post display component and popup/detail content precedent.
- `server/api/feed.get.ts` - Current public feed read endpoint.
- `server/api/posts/index.post.ts` - Current authenticated image-to-feed post creation endpoint.
- `server/api/posts/my-images.get.ts` - Existing user-owned image list for feed publishing.
- `lib/db/schema/post.ts` - Existing feed post table with `locationLogImageId` relationship.
- `lib/db/schema/location-log-image.ts` - Existing public photo visibility/snapshot fields from Phase 10.
- `lib/db/queries/post.ts` - Existing feed queries and `getUserLocationLogImages` publish source.
- `components/place-photo/public-photo-layer.client.vue` - Existing public photo marker layer and safe popup shape.
- `server/api/public/place-photos.get.ts` - Existing unauthenticated public place photo read boundary.
- `composables/use-mapbox.ts` - Existing Mapbox globe projection, fog, spin, marker, popup, and route-layer lifecycle.
- `components/github-globe.vue` - Existing Three.js globe visual precedent for landing-page wow effects; useful for visual ideas but Phase 12 should favor Mapbox for the requested globe.
- `pages/index.vue` - Existing globe/hero usage and visual language that may inform the wow-effect tab.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing feed model: `post` already connects feed posts to `locationLogImage`, so Phase 12 can enrich feed reads with public coordinates rather than inventing a separate map-post entity first.
- Existing public photo model: Phase 10 added public snapshot fields on `locationLogImage`, which are the right source for safe public coordinates/place names.
- Existing feed UI: `pages/feed.vue` already has a simple tab concept (`latest`/`popular`) and a publish entry point; Phase 12 can turn this into a meaningful feed/globe surface.
- Existing Mapbox globe: `useMapbox` initializes Mapbox with `projection: "globe"`, fog, low-zoom spin, markers, and popups. This is the strongest base for a feed globe tab.
- Existing public marker layer: `components/place-photo/public-photo-layer.client.vue` already renders safe public photo markers and popups, but it is static and unbounded; Phase 12 needs live updates and density limiting.

### Established Patterns
- Mutating post/publish endpoints should use `defineAuthenticatedHandler` and owner checks.
- Public reads can be unauthenticated when the payload is explicitly safe and privacy-filtered.
- Request bodies and query params should use Zod validation.
- Provider keys and private diary data stay server-only; public payloads should be shaped intentionally.
- New tests should be focused `node:test` suites under `tests/server/` because full typecheck/lint still has unrelated blockers.

### Integration Points
- Extend feed post queries or add a dedicated public feed-globe query that returns only posts with public coordinates.
- Add a fast publish action near the existing feed composer or dashboard publish flow.
- Add a feed tab or route section for the globe view, using a dedicated client component that initializes Mapbox and renders post points.
- Add a live/near-live update channel for new public photo posts, with graceful fallback when the connection is unavailable.
- Add a client-side or server-shaped density limiter that keeps at most 3-4 active points per local radius and tracks hidden overflow.
- Add tests for public payload safety, unauthenticated globe reads, authenticated publish, exact public coordinate use, density replacement, and no private diary leakage.

</code_context>

<specifics>
## Specific Ideas

- User wants the globe to feel beautiful and alive: points should pop up online in real time as public photo posts are created.
- The feed should remain useful as a normal live feed, while the globe tab exists for a cinematic discovery moment.
- If many points appear in one area, the globe should not become cluttered; it should show a bounded set and cycle out older points.
- Exact coordinates are acceptable because the photos shown on this globe are public by user intent.
- Popup content should remain lean: photo, place, author, date.

</specifics>

<deferred>
## Deferred Ideas

- Full moderation/reporting UI remains deferred to a later moderation/admin phase.
- General push notifications for new feed posts are deferred; this phase is about the feed/globe surface itself.
- Direct messages, follow systems, personalized feed ranking, and full social-network mechanics are deferred.
- Private diary photo discovery is out of scope; only public photo posts appear on the globe.

</deferred>

---

*Phase: 12-Live Feed Globe and Photo Post Map Layer*
*Context gathered: 2026-05-22*
