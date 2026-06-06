# Edit & clear AI-generated route points — Design

Date: 2026-05-30
Status: Approved (brainstorming). Not yet committed. Implementation plan: TBD (writing-plans).

## Context

AI route generation produces `RoutePoint[]` per **variant**, streamed to the client and
persisted server-side in the `aiRoutePoint` table. A session is restorable and shareable
via `sessionId` in the URL (`applyRouteSessionSnapshot` reloads points from the server).

Today the user can place/remove their own **manual/anchor** points (`useUserRoutePoints`)
and hand them to the AI, but the **AI-generated** points themselves are read-only on the
client. The DB layer only supports inserting a point and deleting an entire session — there
is no per-point update/delete.

This feature lets the user **clear and edit the points the AI generated**.

## Decisions (locked via brainstorming)

1. **Operations:** delete one point, clear all points, edit fields (name / time / duration /
   day / description), move a point on the map. (All four.)
2. **Persistence:** server-side and durable — edits survive reload, appear in the shared
   link, and on other devices.
3. **Interaction:** a dedicated **edit mode** toggle (mirrors the existing "Свои точки"
   add-mode), mutually exclusive with add-mode.
4. **Storage approach:** **#1 — direct in-place mutation** of the active variant's points
   (no fork, no overlay table). Other variants (AI history) are untouched; regenerating
   still creates a fresh variant.
5. **Client updates:** optimistic with rollback on failure.
6. **Editing surface:** per-point popup (desktop) and bottom sheet (mobile).
7. **"Clear all"** empties the active variant's points but **keeps the session** (full
   deletion stays with the existing "Удалить маршрут").
8. **Related cache:** on point **delete**, also remove its `routePlaceStory` rows
   (orphan cleanup); on **move**, leave the place-intelligence/story cache (keyed by point
   id; minor staleness accepted).

## Scope

**In scope:** edit mode toggle; drag-to-move; per-point field edit; per-point delete;
clear-all; server persistence; optimistic client with rollback; desktop + mobile parity.

**Out of scope (YAGNI, may add later):** adding brand-new points in edit mode (the
"Свои точки"/anchor flow already covers adding); free reordering of stops within a day
(order is implied by `day` + coordinates).

## Data model & persistence

Reuse `aiRoutePoint` (`lib/db/schema/ai-route.ts`) — **no migration**. New query functions
in `lib/db/queries/ai-route.ts`:

- `updateAiRoutePoint(userId, { variantId, routePointId, patch })` — UPDATE editable columns
  WHERE `userId` + `variantId` + `routePointId`; returns the updated row or `null`.
- `deleteAiRoutePoint(userId, { variantId, routePointId })` — DELETE by the same keys;
  returns `boolean`. Also best-effort deletes matching `routePlaceStory` rows.
- `clearAiRouteVariantPoints(userId, { variantId })` — DELETE all points of the variant;
  returns the deleted count.

**Editable columns:** `name`, `day`, `lat`, `long`, `estimatedStart`,
`estimatedDurationMinutes`, `rationale`. AI metadata (`confidence`, price fields,
`alternativeForPointId`, `sequence`) is left untouched.

**Ownership:** enforced by `userId` (column on `aiRoutePoint`) + `variantId`; endpoints also
verify the variant belongs to a session owned by the user.

## API

Authenticated + CSRF, mirroring `server/api/ai/route/[session-id]/diary.post.ts`:

- `PATCH /api/ai/route/[session-id]/point/[point-id]` — body `{ variantId, patch }`,
  validated by a new `RoutePointPatchSchema` (partial of the editable `RoutePointSchema`
  fields, same constraints; requires ≥1 field). Returns the updated point. 404 if the point
  is missing or not owned.
- `DELETE /api/ai/route/[session-id]/point/[point-id]` — body `{ variantId }`. 204.
- `POST /api/ai/route/[session-id]/points/clear` — body `{ variantId }`. 204.

`session-id`/`point-id` parsed and validated like `[session-id].delete.ts`.

## Client state & data flow

In `composables/use-ai-route-session.ts` (CSRF like `saveRoutePointToDiary`), all optimistic
with rollback:

- `updateRoutePoint(pointId, patch)` — patch `pointsByVariantId[activeVariantId]`, re-sort by
  day; PATCH; revert + toast on failure.
- `deleteRoutePoint(pointId)` — optimistic remove (close sheet if open); DELETE; revert on
  failure.
- `clearActivePoints()` — optimistic clear of the active variant's points; POST clear; revert
  on failure.
- Guards: no-op without `sessionId`/`activeVariantId` and while `isGenerating`.

New `composables/use-route-edit-mode.ts` — module-level `isEditMode` ref + toggle/set,
mirroring the add-mode pattern; mutually exclusive with `useUserRoutePoints` add-mode.

**Data flow:** edit → optimistic mutation of `pointsByVariantId` → API → persisted; the drawn
path / legs recompute from `activePoints`. After reload / shared link / restore,
`applyRouteSessionSnapshot` loads the server points (now including edits).

## UI / interaction (edit mode)

- `components/explore/route-edit-control.vue` — "Редактировать маршрут" toggle (+ point
  count) and "Очистить всё" (with confirm); visible only with an active route that has
  points.
- `components/explore/route-point-editor.vue` — compact form (name / time / duration / day /
  description), reused from the desktop popup and the mobile bottom sheet
  (`place-bottom-sheet.vue`).
- `composables/use-mapbox.ts` — draggable-marker support (enable/disable + dragend callback),
  paralleling the existing `enablePointPlacement`.
- `pages/explore.vue` — watch `isEditMode`: enable draggable generated markers; dragend →
  `updateRoutePoint(id, { coordinates })`; expose per-point "×" (delete) and "Изменить"
  (edit) affordances; suppress auto-fit while editing (like `isCarouselDriven`) so the map
  doesn't jump.

## Error handling & edge cases

- Optimistic + rollback: snapshot the previous value; on API error, revert and toast
  (vue-sonner).
- `400` (validation) → revert + message. `404` (point/session gone, e.g. edited in another
  tab) → `refreshCurrentRouteSessionSnapshot`.
- Editing disabled during `isGenerating`; starting a new generation exits edit mode (do not
  race the stream).
- CSRF + auth on all writes; ownership enforced server-side; last-write-wins per row
  (single user — acceptable).
- Deleting the open point closes the sheet / clears the carousel selection.
- "Clear all" → empty active variant (session kept); empty state; markers/route cleared from
  the map.
- Drag: clamp coordinates to schema ranges; ignore sub-threshold micro-moves.

## Testing

- **Server** (repo source-level style): new queries filter by `userId`/`variantId`/
  `routePointId`; endpoints use `defineAuthenticatedHandler` + CSRF + Zod + 404;
  `RoutePointPatchSchema` rejects out-of-range values (day > 14, duration < 15, bad coords)
  and requires ≥1 field; point delete also clears `routePlaceStory`.
- **Client** (source assertions): `use-ai-route-session` exposes
  `updateRoutePoint`/`deleteRoutePoint`/`clearActivePoints` with optimistic + revert;
  `use-route-edit-mode` exposes `isEditMode` + mutual exclusion; `route-edit-control` and
  `route-point-editor` exist; `explore.vue` wires draggable markers (dragend →
  `updateRoutePoint`), edit/delete in edit mode, and fit-suppression; `use-mapbox` exposes
  draggable enable/disable + dragend.
- **Gates:** `pnpm lint:source` + `pnpm test:server` green. (Note: the pre-existing
  `results actions expose a destructive reset control` failure comes from unrelated WIP in
  `results-actions.vue`, not this feature.)
