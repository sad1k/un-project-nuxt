# Roadmap: WanderLog

**Created:** 2026-05-08
**Mode:** standard
**Granularity:** coarse
**Execution:** parallel where dependencies allow

## Overview

The user selected a Horizontal Layers structure. Phases complete technical layers in dependency order, then integrate them into the AI/PWA MVP.

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Verification Foundation | Make new AI/PWA work testable and avoid planning artifacts breaking project gates | FOUND-01, FOUND-02, FOUND-03 |
| 2 | AI Data and Streaming API | Add user-owned AI persistence and authenticated streaming server endpoint | AIDATA-01, AIDATA-02, AIDATA-03, AIAPI-01, AIAPI-02, AIAPI-03, AIAPI-04, AIAPI-05 |
| 3 | AI Client and Map Integration | Add assistant UI and render AI route suggestions in existing Explore/map flow | AICLI-01, AICLI-02, AICLI-03, AICLI-04 |
| 4 | PWA Shell and Offline Behavior | Add installable app shell and safe offline/read-only behavior | PWA-01, PWA-02, PWA-03, PWA-04 |
| 5 | Hardening and Release Readiness | Verify security, ownership, observability, and deployment readiness | OBS-01, OBS-02, OBS-03 |

## Phase Details

### Phase 1: Verification Foundation

**Goal:** Make the codebase safe to extend with AI/PWA behavior by establishing scoped verification and documenting or fixing blockers.

**Requirements:** FOUND-01, FOUND-02, FOUND-03

**Success Criteria:**
1. `.planning/**` and `.omx/**` do not appear in project lint errors.
2. A focused test runner or test command exists for new server/data code.
3. Current lint/typecheck failures that affect AI/PWA work are listed with owners or resolved.
4. New AI/PWA code has a clear verification command before implementation proceeds.

**Notes:**
- Current `pnpm lint` and `pnpm typecheck` fail on existing unrelated source issues.
- Start with minimal test infrastructure rather than broad refactor.

### Phase 2: AI Data and Streaming API

**Goal:** Add the authenticated server-side AI layer: database schema, query functions, request validation, provider call, streaming response, persistence, and safe errors.

**Requirements:** AIDATA-01, AIDATA-02, AIDATA-03, AIAPI-01, AIAPI-02, AIAPI-03, AIAPI-04, AIAPI-05

**Success Criteria:**
1. Drizzle schema and migrations define user-owned conversations and messages.
2. Query functions enforce `userId` ownership for every conversation/message access.
3. `server/api/ai/chat.post.ts` accepts a validated authenticated prompt request.
4. The endpoint streams assistant response chunks to the client.
5. The final assistant response is persisted after successful completion.
6. Provider errors are sanitized and observable without leaking secrets or prompt bodies.

**Notes:**
- Prefer native `fetch` for the first OpenAI-compatible implementation unless a provider SDK is explicitly approved.
- Keep provider credentials server-only in `lib/env.ts`.

### Phase 3: AI Client and Map Integration

**Goal:** Add the user-facing assistant experience and connect structured route suggestions to the existing Explore/map UI.

**Requirements:** AICLI-01, AICLI-02, AICLI-03, AICLI-04

**Success Criteria:**
1. User can open an assistant panel from Explore or dashboard.
2. UI displays idle, loading, streaming, complete, retry, and error states.
3. Streamed response text appears incrementally.
4. Structured route suggestions can be converted into map route points.
5. Generated route points render on the existing map route UI without breaking current mocked routes.

**Notes:**
- `composables/useRouteGenerator.ts` is currently mock data; preserve the prototype until the API-backed route path replaces it intentionally.

### Phase 4: PWA Shell and Offline Behavior

**Goal:** Add the real PWA layer described in the architecture diagrams without unsafe caching of authenticated mutations or AI streams.

**Requirements:** PWA-01, PWA-02, PWA-03, PWA-04

**Success Criteria:**
1. App has installable manifest metadata.
2. Static app shell and critical assets are cached after first successful visit.
3. Offline users see clear read-only/offline states.
4. Service worker does not cache AI streaming responses or authenticated mutation requests.
5. PWA behavior is manually verified in browser.

**Notes:**
- Push notifications remain v2.
- Add service worker behavior after online AI path is stable.

### Phase 5: Hardening and Release Readiness

**Goal:** Verify the AI/PWA MVP is safe, observable, and ready for deployment review.

**Requirements:** OBS-01, OBS-02, OBS-03

**Success Criteria:**
1. AI endpoint failures are visible in Sentry or sanitized server logs.
2. No AI provider credentials are exposed to browser runtime config.
3. Cross-user conversation/message access is covered by tests.
4. Secret scan of planning and source changes passes.
5. Release checklist covers lint, typecheck, tests, build, and manual PWA/browser verification.

## Requirement Coverage

| Phase | Requirement Count |
|-------|-------------------|
| Phase 1 | 3 |
| Phase 2 | 8 |
| Phase 3 | 4 |
| Phase 4 | 4 |
| Phase 5 | 3 |

All 22 v1 requirements are mapped to exactly one phase.

---

*Roadmap created: 2026-05-08*
