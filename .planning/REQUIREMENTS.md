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
- [ ] **PLACE-02**: User can see pictures of the place in the popup.
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

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap unless explicitly pulled forward.

### Advanced Place Experience

- **ADVPLACE-01**: User can listen to interactive audio history/storytelling for a place.
- **ADVPLACE-02**: User can choose between multiple narration voices or languages.
- **ADVPLACE-03**: Place history content can be cached for offline playback.

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

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---

*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after Explore scope update*
