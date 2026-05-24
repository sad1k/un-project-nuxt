# Requirements: WanderLog

**Defined:** 2026-05-08
**Core Value:** Users can turn their own travel context and preferences into an animated, explainable AI route that they can inspect on the map and save into their travel diary.

## v1 Requirements

Requirements for the fully working Explore page and AI route planning MVP. Existing journal/feed/auth functionality is treated as validated brownfield capability and is not reimplemented unless needed for Explore integration.

### Foundation

- [x] **FOUND-01**: Developer can run a scoped verification command for new Explore/AI work without `.planning`, `.omx`, or `AGENTS.md` artifacts breaking lint.
- [x] **FOUND-02**: Developer can run focused tests for new server/data behavior.
- [x] **FOUND-03**: Existing critical lint/typecheck failures that block Explore work are documented or fixed before dependent phases rely on green gates.
- [x] **FOUND-04**: Explore feature scope is captured in PROJECT, REQUIREMENTS, ROADMAP, research docs, and phase context.

### Explore Input

- [ ] **EXPIN-01**: User can enter a city on Explore with autocomplete/typeahead suggestions.
- [ ] **EXPIN-02**: User can choose trip duration by number of days.
- [ ] **EXPIN-03**: User can choose interests that influence the route.
- [ ] **EXPIN-04**: User can use search and filters to refine generated places.
- [ ] **EXPIN-05**: User can include current location, saved places, and prior diary logs as route context.

### AI Route Generation

- [x] **AIROUTE-01**: User can request an AI-generated route from Explore.
- [x] **AIROUTE-02**: User receives streamed assistant text while route generation is in progress.
- [x] **AIROUTE-03**: AI can use the user's saved locations and logs as context.
- [x] **AIROUTE-04**: User can ask follow-up questions to refine the route.
- [x] **AIROUTE-05**: Server persists route conversations/messages and scopes them to the authenticated user.
- [x] **AIROUTE-06**: AI response includes structured route data suitable for map rendering.

### Route Generation Continuity

- [ ] **GENLIFE-01**: Route generation continues server-side after the user leaves Explore, refreshes, or temporarily disconnects.
- [ ] **GENLIFE-02**: User can see active route-generation progress from a global app surface, not only inside the Explore panel.
- [ ] **GENLIFE-03**: Completed or failed background generations are persisted to user-owned route history and recoverable from the interface.
- [ ] **GENLIFE-04**: User receives an in-app completion notification when a background route generation finishes while the app is open.
- [ ] **GENLIFE-05**: Browser push completion notification is sent only when permission, service worker support, and a saved user subscription are available.
- [ ] **GENLIFE-06**: Background generation status, notification delivery, and route-history recovery remain scoped to the authenticated user and observable without exposing secrets or raw private context.

### Map Route Experience

- [ ] **MAP-01**: User sees generated route markers on the map.
- [ ] **MAP-02**: User sees a route line connecting generated places.
- [ ] **MAP-03**: User sees day-by-day route grouping.
- [ ] **MAP-04**: User sees animated map transitions when the route appears or a place is selected.
- [ ] **MAP-05**: User sees distance information for route legs or places.
- [ ] **MAP-06**: User can view saved places alongside generated route places.

### Place Intelligence

- [ ] **PLACE-01**: User can click a place marker and see a popup with place information.
- [ ] **PLACE-02**: User can see real provider-sourced or WanderLog app-owned pictures of the place in the popup; AI-generated or illustrative pictures must not be presented as place photos.
- [ ] **PLACE-03**: User can see reviews and rating for the place when available.
- [ ] **PLACE-04**: User can see estimated cost for each place when available.
- [ ] **PLACE-05**: User can see how many WanderLog users visited the place when app data is available.
- [ ] **PLACE-06**: User can see best-effort current-time community presence for a place when app data supports it.

### Weather and Tips

- [ ] **TIPS-01**: User receives route tips correlated with weather.
- [ ] **TIPS-02**: User sees what to take on the route based on weather and itinerary context.

### Save to Diary

- [x] **DIARY-01**: User can save a generated route to the diary.
- [x] **DIARY-02**: User can save selected generated places into existing diary/location structures where appropriate.
- [x] **DIARY-03**: Saved route/places remain associated with the authenticated user.

### Observability and Security

- [x] **OBS-01**: AI and Explore provider failures are observable through Sentry or sanitized server logging.
- [x] **OBS-02**: AI, weather, reviews, and place-data credentials remain server-only unless explicitly safe for browser exposure.
- [x] **OBS-03**: Conversation, route, saved-place, and community visit data cannot be read or modified across users.

## Post-v1 Active Requirements

Requirements added after the Explore/Admin foundation to expand WanderLog into a traveler-contribution product.

### Traveler Place Photo Sharing

- [ ] **PHOTO-01**: Authenticated user can upload or attach a photo to an existing or newly selected attraction/place.
- [ ] **PHOTO-02**: User can confirm or adjust the photo's marker/location on the map before saving.
- [ ] **PHOTO-03**: Uploaded place photos remain private and owner-scoped by default.
- [ ] **PHOTO-04**: User can explicitly make a selected place photo public.
- [ ] **PHOTO-05**: Public place photos are visible to other users in relevant place/map surfaces without exposing private diary context.
- [ ] **PHOTO-06**: Owner can remove a photo from public display or delete it, and public reads respect ownership, privacy, and moderation/removal state.

### Real Place Photo Enrichment

- [x] **REALPHOTO-01**: Explore generated-route places resolve photos from real media sources only: public WanderLog place photos first, then configured place/photo providers.
- [x] **REALPHOTO-02**: Google Places photo media is resolved through server-side fresh photo references and never persisted as permanent copied image assets unless provider terms explicitly allow it.
- [x] **REALPHOTO-03**: Place-photo metadata cache records source, attribution, license/terms hints, expiry, provider place identity, and failure state without storing secrets or private route context.
- [x] **REALPHOTO-04**: Fallback order is deterministic: WanderLog public photos -> Google Places Photos -> optional open/provider fallback such as Wikimedia or Foursquare -> explicit missing-photo state.
- [x] **REALPHOTO-05**: AI-generated, stock-like, or illustrative images are not shown as place photos for generated-route places.
- [x] **REALPHOTO-06**: Provider failures, cache misses, and missing-photo states are observable through sanitized logs/tests without exposing provider headers, API keys, prompts, or private location history.

### Live Feed Globe

- [x] **LIVEGLOBE-01**: Authenticated user can quickly publish an uploaded public place photo into the feed through a clear feed-oriented action.
- [x] **LIVEGLOBE-02**: Feed includes a tab or surface that opens a global Mapbox globe for public photo posts.
- [x] **LIVEGLOBE-03**: Newly created public photo posts appear on the globe as live/near-live animated points.
- [x] **LIVEGLOBE-04**: When more than 3-4 public posts exist in one local radius, the globe keeps only the newest bounded set visible, replaces/fades the oldest visible point for new arrivals, and shows an overflow indicator for hidden posts.
- [x] **LIVEGLOBE-05**: Globe point popups show only safe public metadata: photo, place, author display name, and date.
- [x] **LIVEGLOBE-06**: Public globe reads are visible to unauthenticated visitors while publishing remains authenticated and owner-scoped, with tests preventing private diary metadata leakage.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap unless explicitly pulled forward.

### Advanced Place Experience

- [x] **ADVPLACE-01**: User can listen to interactive audio history/storytelling for a place.
- [ ] **ADVPLACE-02**: User can choose between multiple narration voices or languages. *(Partial/deferred in Phase 7: one default voice only.)*
- [x] **ADVPLACE-03**: Place history content can be cached for offline playback.

### Notifications

- **NOTF-01**: User receives general push notifications for relevant travel/feed/events beyond route-generation completion.
- **NOTF-02**: User can configure general notification preferences.

### Advanced AI

- **ADVAI-01**: Assistant can use richer RAG context from images and full diary history.
- **ADVAI-02**: User can save AI-generated routes as reusable route templates.
- **ADVAI-03**: User can choose between multiple configured AI model providers.

### Offline Sync

- **SYNC-01**: User can edit travel logs offline and sync later.
- **SYNC-02**: User can resolve sync conflicts.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web-first Nuxt/PWA project |
| General push notifications in v1 | Route-generation completion notification is pulled into GENLIFE-04/GENLIFE-05; broader feed/travel/event push behavior remains deferred |
| Full offline editing | Sync/conflict complexity is not required for first working Explore route flow |
| Guaranteed live crowd presence | The app can show app-data-based signals, not guaranteed real-world live occupancy |
| Full narrated audio history in v1 | Valuable but depends on content/audio pipeline after place popups work |
| AI provider management UI | Server-side provider configuration is enough for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| EXPIN-01 | Phase 2 | Pending |
| EXPIN-02 | Phase 2 | Pending |
| EXPIN-03 | Phase 2 | Pending |
| EXPIN-04 | Phase 2 | Pending |
| EXPIN-05 | Phase 2 | Pending |
| AIROUTE-01 | Phase 3 | Complete |
| AIROUTE-02 | Phase 3 | Complete |
| AIROUTE-03 | Phase 3 | Complete |
| AIROUTE-04 | Phase 3 | Complete |
| AIROUTE-05 | Phase 3 | Complete |
| AIROUTE-06 | Phase 3 | Complete |
| GENLIFE-01 | Phase 5.1 | Pending |
| GENLIFE-02 | Phase 5.1 | Pending |
| GENLIFE-03 | Phase 5.1 | Pending |
| GENLIFE-04 | Phase 5.1 | Pending |
| GENLIFE-05 | Phase 5.1 | Pending |
| GENLIFE-06 | Phase 5.1 | Pending |
| MAP-01 | Phase 4 | Pending |
| MAP-02 | Phase 4 | Pending |
| MAP-03 | Phase 4 | Pending |
| MAP-04 | Phase 4 | Pending |
| MAP-05 | Phase 4 | Pending |
| MAP-06 | Phase 4 | Pending |
| PLACE-01 | Phase 5 | Pending |
| PLACE-02 | Phase 5 | Pending |
| PLACE-03 | Phase 5 | Pending |
| PLACE-04 | Phase 5 | Pending |
| PLACE-05 | Phase 5 | Pending |
| PLACE-06 | Phase 5 | Pending |
| TIPS-01 | Phase 5 | Pending |
| TIPS-02 | Phase 5 | Pending |
| DIARY-01 | Phase 6 | Complete |
| DIARY-02 | Phase 6 | Complete |
| DIARY-03 | Phase 6 | Complete |
| OBS-01 | Phase 6 | Complete |
| OBS-02 | Phase 6 | Complete |
| OBS-03 | Phase 6 | Complete |
| ADVPLACE-01 | Phase 7 | Complete |
| ADVPLACE-02 | Phase 7 | Partial/Deferred |
| ADVPLACE-03 | Phase 7 | Complete |
| PHOTO-01 | Phase 10 | Pending |
| PHOTO-02 | Phase 10 | Pending |
| PHOTO-03 | Phase 10 | Pending |
| PHOTO-04 | Phase 10 | Pending |
| PHOTO-05 | Phase 10 | Pending |
| PHOTO-06 | Phase 10 | Pending |
| REALPHOTO-01 | Phase 11 | Complete |
| REALPHOTO-02 | Phase 11 | Complete |
| REALPHOTO-03 | Phase 11 | Complete |
| REALPHOTO-04 | Phase 11 | Complete |
| REALPHOTO-05 | Phase 11 | Complete |
| REALPHOTO-06 | Phase 11 | Complete |
| LIVEGLOBE-01 | Phase 12 | Complete |
| LIVEGLOBE-02 | Phase 12 | Complete |
| LIVEGLOBE-03 | Phase 12 | Complete |
| LIVEGLOBE-04 | Phase 12 | Complete |
| LIVEGLOBE-05 | Phase 12 | Complete |
| LIVEGLOBE-06 | Phase 12 | Complete |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0
- Post-v1 active photo-sharing requirements: 6 total, 6 mapped to Phase 10
- Post-v1 real place photo enrichment requirements: 6 total, 6 mapped to Phase 11
- Post-v1 live feed globe requirements: 6 total, 6 mapped to Phase 12

---

*Requirements defined: 2026-05-08*
*Last updated: 2026-05-22 after adding Phase 12 live feed globe scope*
