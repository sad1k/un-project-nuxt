# Requirements: WanderLog

**Defined:** 2026-05-08
**Core Value:** Users can turn their own travel context into useful AI-assisted route recommendations and keep the travel journal usable as a reliable web app.

## v1 Requirements

Requirements for the AI/PWA MVP. Existing journal/feed/auth functionality is treated as validated brownfield capability and is not reimplemented unless needed for integration.

### Foundation

- [ ] **FOUND-01**: Developer can run a scoped verification command for new AI/PWA work without `.planning` or `.omx` artifacts breaking lint.
- [ ] **FOUND-02**: Developer can run focused tests for new server/data behavior.
- [ ] **FOUND-03**: Existing critical lint/typecheck failures that block AI/PWA work are documented or fixed before dependent phases rely on green gates.

### AI Data

- [ ] **AIDATA-01**: User has AI conversations stored in the database and scoped to their account.
- [ ] **AIDATA-02**: User has AI messages stored with role, content, conversation relation, and timestamps.
- [ ] **AIDATA-03**: Server can load bounded recent conversation context only for the authenticated owner.

### AI API

- [ ] **AIAPI-01**: User can submit an authenticated AI travel prompt to a Nitro endpoint.
- [ ] **AIAPI-02**: Server validates AI prompt requests with Zod before calling the model provider.
- [ ] **AIAPI-03**: User receives streamed assistant response chunks from the server.
- [ ] **AIAPI-04**: Server persists the final assistant response after successful streaming.
- [ ] **AIAPI-05**: Server handles provider errors without leaking secrets, prompts, or response bodies to logs.

### AI Client

- [ ] **AICLI-01**: User can open an assistant UI from the Explore or dashboard experience.
- [ ] **AICLI-02**: User can see loading, streaming, error, retry, and completion states.
- [ ] **AICLI-03**: User can receive route suggestions in a structure that the map/explore UI can render.
- [ ] **AICLI-04**: User can view generated route points on the existing map route UI.

### PWA

- [ ] **PWA-01**: User has installable app metadata through a manifest.
- [ ] **PWA-02**: User can load a cached app shell after the first successful visit.
- [ ] **PWA-03**: User sees a clear offline/read-only state when network-only features are unavailable.
- [ ] **PWA-04**: AI streaming and authenticated mutations are not cached incorrectly by the service worker.

### Observability and Security

- [ ] **OBS-01**: AI endpoint failures are observable through the existing Sentry setup or sanitized server logging.
- [ ] **OBS-02**: AI provider credentials remain server-only and are validated through environment schema.
- [ ] **OBS-03**: Conversation and route suggestion data cannot be read or modified across users.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: User receives push notifications for relevant travel/feed events.
- **NOTF-02**: User can configure notification preferences.

### Advanced AI

- **ADVAI-01**: Assistant can use richer RAG context from travel logs and image metadata.
- **ADVAI-02**: User can save AI-generated routes as reusable route plans.
- **ADVAI-03**: User can choose between multiple configured AI model providers.

### Offline Sync

- **SYNC-01**: User can edit travel logs offline and sync later.
- **SYNC-02**: User can resolve sync conflicts.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web-first Nuxt/PWA project |
| Push notifications in v1 | Requires service worker subscriptions and delivery design beyond first PWA shell |
| Full offline editing | Sync/conflict complexity is not required for AI/PWA MVP |
| Full RAG over images | Basic conversation and route suggestions must work first |
| AI provider management UI | Server-side provider configuration is enough for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| AIDATA-01 | Phase 2 | Pending |
| AIDATA-02 | Phase 2 | Pending |
| AIDATA-03 | Phase 2 | Pending |
| AIAPI-01 | Phase 2 | Pending |
| AIAPI-02 | Phase 2 | Pending |
| AIAPI-03 | Phase 2 | Pending |
| AIAPI-04 | Phase 2 | Pending |
| AIAPI-05 | Phase 2 | Pending |
| AICLI-01 | Phase 3 | Pending |
| AICLI-02 | Phase 3 | Pending |
| AICLI-03 | Phase 3 | Pending |
| AICLI-04 | Phase 3 | Pending |
| PWA-01 | Phase 4 | Pending |
| PWA-02 | Phase 4 | Pending |
| PWA-03 | Phase 4 | Pending |
| PWA-04 | Phase 4 | Pending |
| OBS-01 | Phase 5 | Pending |
| OBS-02 | Phase 5 | Pending |
| OBS-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---

*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after initial roadmap creation*
