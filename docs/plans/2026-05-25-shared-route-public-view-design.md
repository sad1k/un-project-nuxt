# Shared route — public read-only view

**Date:** 2026-05-25
**Status:** Design approved, ready for implementation plan
**Area:** Explore / AI route sharing

## Problem

The `Share` action in the explore page produces a link of the form
`/explore?sessionId=<N>`. The intent is that anyone with the link can open
the route. Today the link is broken:

1. `pages/explore.vue` (`onMounted`) calls `restoreRouteSession(N)`, which
   fetches `GET /api/ai/route/[session-id]`.
2. That endpoint is wrapped in `defineAuthenticatedHandler` → 401 for
   unauthenticated visitors.
3. Inside, `findAiRouteSessionByIdForUser(userId, sessionId)` adds
   `eq(aiRouteSession.userId, userId)` → 404 even for an authenticated
   non-owner.

Result: the share link only works for the route's author. For anyone else
the page loads with an empty map and no route is restored.

## Goal

Anyone with a share link — including unauthenticated visitors — can open
the route and see the points, the connecting line, day breakdown and basic
metadata. The viewer cannot mutate the session (no save-to-diary, no
follow-up, no regenerate). Owner experience is unchanged.

## Access model

- **Anyone with the link can view.** Sequential session IDs are guessable
  but the snapshot contains no PII — only AI-generated descriptions of
  places. Opaque share tokens are a future improvement, out of scope here.
- **Viewer capabilities:** view only. Write actions are hidden and replaced
  with a `Sign in` CTA where appropriate.

## Architecture

```
[Anon / non-owner]
  ↓ GET /explore?sessionId=N
  ↓ restoreRouteSession(N)
  ├─ try GET /api/ai/route/N           (private, owner-only)  → 401/404
  └─ fallback GET /api/ai/route/N/shared  (NEW, public)        → 200
        ↓
   snapshot applied, isReadOnly = true
        ↓
   map + panel render; write actions hidden or routed to sign-in
```

Key decisions:

- **Two endpoints, not one.** The existing `/api/ai/route/[id]` stays
  owner-only with no contract change. A new
  `/api/ai/route/[id]/shared` returns a sanitized snapshot for public use.
  This keeps owner-only data (diary saves, request context with saved
  place ids, full event log) out of the public surface.
- **`isReadOnly` is derived from fetch outcome**, not from
  `useSession()`. Owner = private fetch succeeded. Read-only = had to fall
  back to public. This correctly covers the "authenticated non-owner"
  case.
- **`requestContext` is not exposed** in the public snapshot. Only
  `cityName` and `selectedDays` are surfaced — enough for the panel
  header. Saved-place ids, diary log ids and current-location data stay
  private.
- **Weather tips / place intelligence / place story are not made public**
  in this change. They already have `unavailable` fallbacks on the client
  and will silently degrade for anon viewers. Making them public is a
  separate task.

## Files changed

| File | Change |
|---|---|
| `server/api/ai/route/[session-id]/shared.get.ts` | **new** — public GET handler |
| `lib/db/queries/ai-route.ts` | **new** `findAiRouteSessionByIdPublic(sessionId)` |
| `composables/use-ai-route-session.ts` | `isReadOnly` ref, public fallback in `restoreRouteSession`, write-action gates, `applySharedRouteSessionSnapshot` |
| `components/explore/route-panel.vue` | hide wizard sections / history / follow-up; replace footer with sign-in CTA when `isReadOnly` |
| `components/explore/results-actions.vue` | hide history/follow-up/weather buttons when `isReadOnly`; keep share |
| `components/explore/place-bottom-sheet.vue` | hide save / story actions when `isReadOnly` |
| `components/explore/place-popup.ts` | accept `includeSaveCta` option |
| `pages/explore.vue` | pass `!isReadOnly` into popup builder |
| `components/explore/route-step-carousel.vue` | hide per-point save button when `isReadOnly` |
| `tests/server/shared-route-snapshot.test.mjs` | **new** — integration tests |

## API contract — `GET /api/ai/route/[session-id]/shared`

```ts
type SharedRouteSessionSnapshot = {
  sessionId: number;
  status: "generating" | "completed" | "failed";
  activeVariantId: number | null;
  cityName: string | null;
  selectedDays: number | null;
  variants: Array<{
    id: number;
    parentVariantId?: number;
    status: "generating" | "completed" | "failed";
    title?: string;
    summary?: string;
    pointCount: number;
  }>;
  pointsByVariantId: Record<number, RoutePoint[]>;
};
```

Explicitly **excluded** from the private snapshot shape:
`requestContext`, `events`, `diarySave`, `notificationStatus`,
`failureCode`, `failureStage`, `generationStartedAt|HeartbeatAt|CompletedAt`.

`cityName` is read from `aiRouteSession.cityName` (already persisted in
the row). `selectedDays` is parsed from `requestContextJson` — only that
single field, not the rest of the context.

Errors:

- `400 "Некорректный ID сессии маршрута"` — `session-id` is not a
  positive integer.
- `404 "Маршрут не найден"` — session does not exist.

No `user.id` appears in the response payload.

## DB query

`findAiRouteSessionByIdPublic(sessionId: number)` lives next to
`findAiRouteSessionByIdForUser` in `lib/db/queries/ai-route.ts`:

- Same shape with `variants` and nested `points`.
- **No** `user-id` filter — `where: eq(aiRouteSession.id, sessionId)`.
- **No** `messages` and **no** `events` relations — they aren't needed by
  the public snapshot and shouldn't be pulled.

## Client fallback — `useAiRouteSession`

```ts
const isReadOnly = ref(false);

async function restoreRouteSession(explicitSessionId?: number) {
  if (!import.meta.client) return;
  const nextSessionId = explicitSessionId ?? readStoredRouteSessionId();
  if (!nextSessionId || (!explicitSessionId && sessionId.value)) return;

  try {
    const snapshot = await loadRouteSessionSnapshot(nextSessionId);
    applyRouteSessionSnapshot(snapshot);
    isReadOnly.value = false;
    return;
  }
  catch (caughtError) {
    const status = readStatusCode(caughtError);
    if (status !== 401 && status !== 403 && status !== 404) {
      console.error("[useAiRouteSession] Private route restore failed", {
        error: serializeError(caughtError),
        storedSessionId: nextSessionId,
        ...getClientDiagnosticContext(),
      });
      persistRouteSessionReference(null);
      return;
    }
  }

  try {
    const shared = await loadSharedRouteSessionSnapshot(nextSessionId);
    applySharedRouteSessionSnapshot(shared);
    isReadOnly.value = true;
  }
  catch (caughtError) {
    console.error("[useAiRouteSession] Shared route restore failed", {
      error: serializeError(caughtError),
      storedSessionId: nextSessionId,
      ...getClientDiagnosticContext(),
    });
    persistRouteSessionReference(null);
  }
}
```

`applySharedRouteSessionSnapshot` proxies `sessionId`, `activeVariantId`,
`variants`, `pointsByVariantId`. It sets `lastRequestContext.value =
null`, `events.value = []`, `lastWarning.value = null`. This guarantees
that `submitFollowUp` (which guards on `lastRequestContext`) cannot
silently succeed in the anon path.

Server-side handlers are already auth-gated, but write-actions are also
gated on the client to fail fast without a network round-trip:

```ts
async function saveRoutePointToDiary(routePointId: string) {
  if (isReadOnly.value) return;
  // ...
}
async function generateRoute(requestContext: ExploreRequestContext) {
  if (isReadOnly.value) return;
  // ...
}
async function submitFollowUp(message: string) {
  if (isReadOnly.value) return;
  // ...
}
```

`isReadOnly` is reset to `false` in `resetRouteSession()` so the flag does
not leak between sessions (e.g. anon viewer signs in and then generates a
new route on the same tab).

`useAiRouteSession()` returns `isReadOnly` alongside the existing surface.

## UI

### `components/explore/route-panel.vue`

| Surface | Owner | Read-only |
|---|---|---|
| Header copy | "AI-планировщик маршрута" | "Маршрут от другого пользователя" |
| City typeahead | shown | hidden |
| Days picker | shown | hidden |
| Interests chips | shown | hidden |
| Transport mode | shown | hidden |
| Route session block | shown | shown |
| `ExploreRouteHistory` | shown | hidden |
| `ExploreRouteFollowUp` | shown | hidden |
| Footer (generate / save / share-3) | shown | replaced with `Sign in` CTA |

The CTA reuses the same sign-in target as `AppUserMenu`. If a
`?redirect=` parameter is supported, the redirect is the current URL
(`/explore?sessionId=N`).

### `components/explore/results-actions.vue`

Read-only keeps only `Share`. Hidden: `Weather`, `History`, `Follow-up`.
The diary pill disappears naturally — `diarySave` is absent in the public
snapshot.

### Popup, bottom sheet, carousel

- `createPlacePopupHTML(intelligence, opts)` gains `includeSaveCta`
  (default `true`). `pages/explore.vue` passes
  `{ includeStoryCta: !isReadOnly.value, includeSaveCta: !isReadOnly.value }`.
- `components/explore/place-bottom-sheet.vue` hides save and story
  buttons when `isReadOnly`. Directions stays — it opens Google Maps and
  doesn't touch the backend.
- `components/explore/route-step-carousel.vue` hides per-point save when
  `isReadOnly`.

### What still works for anon

- Map render (markers, route line, fit-to-route)
- Day selector
- Route stats (hours / places / distance)
- Place names list with story-point selection
- Bottom-sheet open (basic place info; no save/story CTAs)
- Directions → Google Maps
- Share (re-share the same link)

### What degrades silently

- Weather tips → existing `RouteWeatherTips` "unavailable" fallback.
- Place intelligence in popup → `createUnavailablePlaceIntelligence`.
- Place story → CTA hidden, no attempts.

## Error handling

### Server

- Invalid `session-id` → 400.
- Session not found → 404.
- `requestContextJson` parse failure (for `cityName`/`selectedDays`) →
  return `selectedDays: null`, don't fail the request.
- Individual `RoutePoint` rows that fail `RoutePointSchema.safeParse` are
  filtered out (same as the private handler).
- DB error → bubble to Nitro (500). Log includes `sessionId`, no user id.

### Client

- Private 401 / 403 / 404 → silent fallback to public.
- Private network / 5xx → log, no fallback (don't hide owner-side
  outages).
- Public 404 → log + `persistRouteSessionReference(null)`. UI stays empty
  ("no route" state).
- Public network / 5xx → log, empty state.

## Tests

### Integration — `tests/server/shared-route-snapshot.test.mjs` (new)

Pattern follows existing `tests/server/*.test.mjs`:

- `GET /api/ai/route/<non-existent>/shared` with no cookie → 404.
- Create a session for user A through direct query calls, then:
  - `GET .../shared` with no auth → 200. Body has no `requestContext`,
    no `events`, no `diarySave`, no `userId`, no `failureCode`. Body has
    `pointsByVariantId`, `cityName`, `selectedDays`.
  - `GET .../shared` as user B → 200, same body.
- Regression: `GET /api/ai/route/<id>` with no auth → 401.
- Regression: `GET /api/ai/route/<id>` as user B → 404.

### Manual verification

Via dev server:

- Sign in, generate (or pick existing) route, copy share URL.
- Open the same URL in an incognito window → route restores; save /
  follow-up / generate are not visible; sign-in CTA is visible.
- Open a place pin in incognito → bottom sheet opens; no save button;
  directions still works.
- Before / after screenshots for confirmation.

## Out of scope (follow-up tasks)

- Opaque share tokens (e.g. nanoid) instead of sequential session IDs.
- Public `place-intelligence` / `weather-tips` / `place-story`.
- Analytics for views-by-non-owner.
- Owner identity ("shared by X") in the read-only view.

## Approval

User confirmed access model (anyone with link), capability scope (view
only + sign-in CTA), and design sections 1–4 before this doc was
written.
