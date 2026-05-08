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

- [ ] **AIROUTE-01**: User can request an AI-generated route from Explore.
- [ ] **AIROUTE-02**: User receives streamed assistant text while route generation is in progress.
- [ ] **AIROUTE-03**: AI can use the user's saved locations and logs as context.
- [ ] **AIROUTE-04**: User can ask follow-up questions to refine the route.
- [ ] **AIROUTE-05**: Server persists route conversations/messages and scopes them to the authenticated user.
- [ ] **AIROUTE-06**: AI response includes structured route data suitable for map rendering.

### Map Route Experience

- [ ] **MAP-01**: User sees generated route markers on the map.
- [ ] **MAP-02**: User sees a route line connecting generated places.
- [ ] **MAP-03**: User sees day-by-day route grouping.
- [ ] **MAP-04**: User sees animated map transitions when the route appears or a place is selected.
- [ ] **MAP-05**: User sees distance information for route legs or places.
- [ ] **MAP-06**: User can view saved places alongside generated route places.

### Place Intelligence

- [ ] **PLACE-01**: User can click a place marker and see a popup with place information.
- [ ] **PLACE-02**: User can see pictures of the place in the popup.
- [ ] **PLACE-03**: User can see reviews and rating for the place when available.
- [ ] **PLACE-04**: User can see estimated cost for each place when available.
- [ ] **PLACE-05**: User can see how many WanderLog users visited the place when app data is available.
- [ ] **PLACE-06**: User can see best-effort current-time community presence for a place when app data supports it.

### Weather and Tips

- [ ] **TIPS-01**: User receives route tips correlated with weather.
- [ ] **TIPS-02**: User sees what to take on the route based on weather and itinerary context.

### Save to Diary

- [ ] **DIARY-01**: User can save a generated route to the diary.
- [ ] **DIARY-02**: User can save selected generated places into existing diary/location structures where appropriate.
- [ ] **DIARY-03**: Saved route/places remain associated with the authenticated user.

### Observability and Security

- [ ] **OBS-01**: AI and Explore provider failures are observable through Sentry or sanitized server logging.
- [ ] **OBS-02**: AI, weather, reviews, and place-data credentials remain server-only unless explicitly safe for browser exposure.
- [ ] **OBS-03**: Conversation, route, saved-place, and community visit data cannot be read or modified across users.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap unless explicitly pulled forward.

### Advanced Place Experience

- **ADVPLACE-01**: User can listen to interactive audio history/storytelling for a place.
- **ADVPLACE-02**: User can choose between multiple narration voices or languages.
- **ADVPLACE-03**: Place history content can be cached for offline playback.

### Notifications

- **NOTF-01**: User receives push notifications for relevant travel/feed/events.
- **NOTF-02**: User can configure notification preferences.

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
| Push notifications in v1 | Requires service worker subscriptions and delivery design beyond Explore MVP |
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
| AIROUTE-01 | Phase 3 | Pending |
| AIROUTE-02 | Phase 3 | Pending |
| AIROUTE-03 | Phase 3 | Pending |
| AIROUTE-04 | Phase 3 | Pending |
| AIROUTE-05 | Phase 3 | Pending |
| AIROUTE-06 | Phase 3 | Pending |
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
| DIARY-01 | Phase 6 | Pending |
| DIARY-02 | Phase 6 | Pending |
| DIARY-03 | Phase 6 | Pending |
| OBS-01 | Phase 6 | Pending |
| OBS-02 | Phase 6 | Pending |
| OBS-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---

*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after Explore scope update*
