# Edit & Clear AI-Generated Route Points — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the user edit (name/time/duration/day/description), move, delete, and bulk-clear AI-generated route points, with changes persisted server-side on the active variant.

**Architecture:** Direct in-place mutation of the active variant's `aiRoutePoint` rows (Approach #1 from the design doc). New DB queries + authenticated CSRF endpoints (PATCH/DELETE point, POST clear); client gets optimistic mutations with rollback in `use-ai-route-session`; a dedicated edit-mode toggle makes map markers draggable and reveals per-point edit/delete, mirroring the existing "Свои точки" add-mode.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, drizzle-orm (libSQL), Zod, Mapbox GL, node:test source-assertion tests.

**Design doc:** [docs/plans/2026-05-30-edit-ai-route-points-design.md](2026-05-30-edit-ai-route-points-design.md)

**Conventions for this repo (read before starting):**
- Server tests are **source-assertion** style (`readFile` + `assert.match`), run with `pnpm test:server` (`node scripts/run-node-tests.mjs tests/server`). There is **no DB test harness** — do not invent one. Each "failing test" below is a source assertion that fails until the code exists.
- Lint gate: `pnpm lint:source` (treat failures as blockers).
- Commits authored as the user only — **no** `Co-Authored-By` / "Generated with Claude Code" trailers (see `~/.claude/CLAUDE.md`).
- A pre-existing failure (`results actions expose a destructive reset control`) comes from unrelated WIP in `results-actions.vue`; ignore it when judging green.
- REQUIRED SUB-SKILL while implementing: superpowers:test-driven-development.

---

## Task 0: Feature branch

**Step 1:** Create a branch off `main` (do not commit feature work to `main`).

```bash
git checkout -b feat/edit-ai-route-points
```

**Step 2:** Confirm the design doc is present (it is committed-or-untracked in `docs/plans/`).

Run: `ls docs/plans/2026-05-30-edit-ai-route-points*.md`
Expected: both `-design.md` and this plan file are listed.

---

## Task 1: Patch contract schema

**Files:**
- Modify: `lib/ai/route-contract.ts`
- Test: `tests/server/edit-ai-route-points.test.mjs` (create)

**Step 1: Write the failing test**

Create `tests/server/edit-ai-route-points.test.mjs`:

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const contractSource = await readFile("lib/ai/route-contract.ts", "utf8");

test("route contract exposes a point patch schema for edits", () => {
  assert.match(contractSource, /export const RoutePointPatchSchema/);
  assert.match(contractSource, /export type RoutePointPatch/);
  // Reuses the existing coordinate schema and requires at least one field.
  assert.match(contractSource, /coordinates: ExploreCoordinatesSchema\.optional\(\)/);
  assert.match(contractSource, /at least one field|Не передано ни одного поля|hasAtLeastOneField/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/edit-ai-route-points.test.mjs`
Expected: FAIL (no `RoutePointPatchSchema`).

**Step 3: Implement**

In `lib/ai/route-contract.ts`, after `RoutePointSchema` (around line 122), add:

```ts
export const RoutePointPatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  day: z.number().int().min(1).max(14).optional(),
  coordinates: ExploreCoordinatesSchema.optional(),
  estimatedStart: z.string().trim().min(1).max(40).optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(720).optional(),
  rationale: z.string().trim().min(1).max(500).optional(),
}).refine(
  patch => Object.values(patch).some(value => value !== undefined),
  { message: "Нужно передать хотя бы одно поле для изменения точки." }, // at least one field
);

export type RoutePointPatch = z.infer<typeof RoutePointPatchSchema>;
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/edit-ai-route-points.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/ai/route-contract.ts tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add RoutePointPatchSchema for point edits"
```

---

## Task 2: DB queries (update / delete / clear)

**Files:**
- Modify: `lib/db/queries/ai-route.ts` (import `routePlaceStory`; add three functions)
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append to the test file):

```js
const queriesSource = await readFile("lib/db/queries/ai-route.ts", "utf8");

test("ai-route queries support per-point update, delete and clear", () => {
  assert.match(queriesSource, /export async function updateAiRoutePoint/);
  assert.match(queriesSource, /export async function deleteAiRoutePoint/);
  assert.match(queriesSource, /export async function clearAiRouteVariantPoints/);
  // Ownership filter on every mutation.
  assert.match(queriesSource, /eq\(aiRoutePoint\.userId, userId\)/);
  assert.match(queriesSource, /eq\(aiRoutePoint\.routePointId, input\.routePointId\)/);
  // Deleting a point also cleans up its place story rows.
  assert.match(queriesSource, /\.delete\(routePlaceStory\)/);
});
```

**Step 2: Run** `node --test tests/server/edit-ai-route-points.test.mjs` → FAIL.

**Step 3: Implement.** In `lib/db/queries/ai-route.ts`:

3a. Add `routePlaceStory` to the schema import (it is already imported from `../schema` for other tables — add the name):

```ts
import {
  aiRouteEvent,
  aiRouteMessage,
  aiRoutePoint,
  aiRouteSession,
  aiRouteVariant,
  routeDiarySave,
  routePlaceStory,
} from "../schema";
```

> If `routePlaceStory` is not re-exported from `../schema`, import it from `../schema/route-place-story` instead. Verify with `grep -n "routePlaceStory" lib/db/schema/index.ts`.

3b. Append the three functions (near `deleteAiRouteSessionByIdForUser`):

```ts
export async function updateAiRoutePoint(
  userId: number,
  input: {
    variantId: number;
    routePointId: string;
    patch: {
      name?: string;
      day?: number;
      coordinates?: { lat: number; long: number };
      estimatedStart?: string;
      estimatedDurationMinutes?: number;
      rationale?: string;
    };
  },
) {
  const values: Partial<typeof aiRoutePoint.$inferInsert> = {};
  if (input.patch.name !== undefined)
    values.name = input.patch.name;
  if (input.patch.day !== undefined)
    values.day = input.patch.day;
  if (input.patch.coordinates) {
    values.lat = input.patch.coordinates.lat;
    values.long = input.patch.coordinates.long;
  }
  if (input.patch.estimatedStart !== undefined)
    values.estimatedStart = input.patch.estimatedStart;
  if (input.patch.estimatedDurationMinutes !== undefined)
    values.estimatedDurationMinutes = input.patch.estimatedDurationMinutes;
  if (input.patch.rationale !== undefined)
    values.rationale = input.patch.rationale;

  if (Object.keys(values).length === 0)
    return null;

  const [updated] = await db
    .update(aiRoutePoint)
    .set(values)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ))
    .returning();

  return updated ?? null;
}

export async function deleteAiRoutePoint(
  userId: number,
  input: { sessionId: number; variantId: number; routePointId: string },
) {
  const [deleted] = await db
    .delete(aiRoutePoint)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ))
    .returning();

  if (deleted) {
    await db
      .delete(routePlaceStory)
      .where(and(
        eq(routePlaceStory.userId, userId),
        eq(routePlaceStory.sessionId, input.sessionId),
        eq(routePlaceStory.variantId, input.variantId),
        eq(routePlaceStory.routePointId, input.routePointId),
      ));
  }

  return Boolean(deleted);
}

export async function clearAiRouteVariantPoints(
  userId: number,
  input: { sessionId: number; variantId: number },
) {
  const deleted = await db
    .delete(aiRoutePoint)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
    ))
    .returning();

  await db
    .delete(routePlaceStory)
    .where(and(
      eq(routePlaceStory.userId, userId),
      eq(routePlaceStory.sessionId, input.sessionId),
      eq(routePlaceStory.variantId, input.variantId),
    ));

  return deleted.length;
}
```

**Step 4: Run** `node --test tests/server/edit-ai-route-points.test.mjs` → PASS. Then `pnpm lint:source` (fix any import-order issues — keep the schema import alphabetised).

**Step 5: Commit**

```bash
git add lib/db/queries/ai-route.ts tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add update/delete/clear queries for AI route points"
```

---

## Task 3: API endpoints

**Files:**
- Create: `server/api/ai/route/[session-id]/point/[point-id].patch.ts`
- Create: `server/api/ai/route/[session-id]/point/[point-id].delete.ts`
- Create: `server/api/ai/route/[session-id]/points/clear.post.ts`
- Test: `tests/server/edit-ai-route-points.test.mjs`

Mirror the existing template `server/api/ai/route/[session-id]/diary.post.ts` (auth via `defineAuthenticatedHandler`, `getRouterParam`, Zod `safeParse`, `createError`). CSRF is enforced globally by `nuxt-csurf` for state-changing methods; the client sends the `csrf-token` header (Task 4).

**Step 1: Add failing assertions** (append):

```js
const patchEndpoint = await readFile("server/api/ai/route/[session-id]/point/[point-id].patch.ts", "utf8").catch(() => "");
const deleteEndpoint = await readFile("server/api/ai/route/[session-id]/point/[point-id].delete.ts", "utf8").catch(() => "");
const clearEndpoint = await readFile("server/api/ai/route/[session-id]/points/clear.post.ts", "utf8").catch(() => "");

test("point endpoints are authenticated and validated", () => {
  for (const src of [patchEndpoint, deleteEndpoint, clearEndpoint]) {
    assert.match(src, /defineAuthenticatedHandler/);
    assert.match(src, /event\.context\.user\.id/);
  }
  assert.match(patchEndpoint, /RoutePointPatchSchema/);
  assert.match(patchEndpoint, /updateAiRoutePoint/);
  assert.match(patchEndpoint, /statusCode: 404/);
  assert.match(deleteEndpoint, /deleteAiRoutePoint/);
  assert.match(clearEndpoint, /clearAiRouteVariantPoints/);
});
```

**Step 2: Run** → FAIL (files don't exist).

**Step 3: Implement.**

`server/api/ai/route/[session-id]/point/[point-id].patch.ts`:

```ts
import { z } from "zod";

import { RoutePointPatchSchema } from "~/lib/ai/route-contract";
import { updateAiRoutePoint } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const BodySchema = z.object({
  variantId: z.number().int().positive(),
  patch: RoutePointPatchSchema,
});

export default defineAuthenticatedHandler(async (event) => {
  parsePositiveId(getRouterParam(event, "session-id"), "сессии");
  const routePointId = parseRoutePointId(getRouterParam(event, "point-id"));

  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос правки точки" });
  }

  const updated = await updateAiRoutePoint(event.context.user.id, {
    variantId: body.data.variantId,
    routePointId,
    patch: body.data.patch,
  });

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Точка маршрута не найдена" });
  }

  return { point: updated };
});

function parsePositiveId(input: string | undefined, label: string) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Некорректный ID ${label}` });
  }
  return value;
}

function parseRoutePointId(input: string | undefined) {
  const value = input ? decodeURIComponent(input) : "";
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный ID точки" });
  }
  return value;
}
```

`server/api/ai/route/[session-id]/point/[point-id].delete.ts`:

```ts
import { z } from "zod";

import { deleteAiRoutePoint } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  variantId: z.coerce.number().int().positive(),
});

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parsePositiveId(getRouterParam(event, "session-id"), "сессии");
  const routePointId = parseRoutePointId(getRouterParam(event, "point-id"));

  const query = QuerySchema.safeParse(getQuery(event));
  if (!query.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос удаления точки" });
  }

  const deleted = await deleteAiRoutePoint(event.context.user.id, {
    sessionId,
    variantId: query.data.variantId,
    routePointId,
  });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Точка маршрута не найдена" });
  }

  setResponseStatus(event, 204);
  return null;
});

// parsePositiveId / parseRoutePointId: copy from the .patch.ts handler above.
```

`server/api/ai/route/[session-id]/points/clear.post.ts`:

```ts
import { z } from "zod";

import { clearAiRouteVariantPoints } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const BodySchema = z.object({
  variantId: z.number().int().positive(),
});

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parsePositiveId(getRouterParam(event, "session-id"), "сессии");

  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос очистки точек" });
  }

  const clearedCount = await clearAiRouteVariantPoints(event.context.user.id, {
    sessionId,
    variantId: body.data.variantId,
  });

  return { clearedCount };
});

function parsePositiveId(input: string | undefined, label: string) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Некорректный ID ${label}` });
  }
  return value;
}
```

**Step 4: Run** the test (PASS) and `pnpm lint:source`.

**Step 5: Commit**

```bash
git add "server/api/ai/route/[session-id]/point" "server/api/ai/route/[session-id]/points" tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add point patch/delete and clear endpoints"
```

---

## Task 4: Client mutations (optimistic + rollback)

**Files:**
- Modify: `composables/use-ai-route-session.ts`
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append):

```js
const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");

test("route session exposes optimistic point edit/delete/clear", () => {
  for (const fn of ["updateRoutePoint", "deleteRoutePoint", "clearActivePoints"]) {
    assert.match(sessionSource, new RegExp(`function ${fn}`));
    assert.match(sessionSource, new RegExp(`${fn},`)); // exported in the return object
  }
  // Optimistic mutation followed by revert-on-failure.
  assert.match(sessionSource, /const previous = pointsByVariantId\.value/);
  assert.match(sessionSource, /\[variantId\]: previous/); // rollback path
  assert.match(sessionSource, /method: "PATCH"/);
  assert.match(sessionSource, /method: "DELETE"/);
  assert.match(sessionSource, /points\/clear/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement.** In `composables/use-ai-route-session.ts`:

3a. Import the patch type at the top with the other type import:

```ts
import type { RouteEventEnvelope, RoutePoint, RoutePointPatch } from "~/lib/ai/route-contract";
```

3b. Add a pure helper near `upsertPoint`:

```ts
function applyPatchToRoutePoint(point: RoutePoint, patch: RoutePointPatch): RoutePoint {
  return {
    ...point,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.day !== undefined ? { day: patch.day } : {}),
    ...(patch.coordinates ? { coordinates: patch.coordinates } : {}),
    ...(patch.estimatedStart !== undefined ? { estimatedStart: patch.estimatedStart } : {}),
    ...(patch.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: patch.estimatedDurationMinutes } : {}),
    ...(patch.rationale !== undefined ? { rationale: patch.rationale } : {}),
  };
}
```

3c. Add the three actions (near `saveRoutePointToDiary`):

```ts
async function updateRoutePoint(routePointId: string, patch: RoutePointPatch) {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  const index = previous.findIndex(point => point.id === routePointId);
  if (index === -1)
    return;

  const optimistic = [...previous];
  optimistic[index] = applyPatchToRoutePoint(optimistic[index], patch);
  pointsByVariantId.value = {
    ...pointsByVariantId.value,
    [variantId]: [...optimistic].sort((first, second) => first.day - second.day),
  };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/point/${encodeURIComponent(routePointId)}`, {
      method: "PATCH",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      body: { variantId, patch },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось сохранить изменение точки.";
    console.error("[useAiRouteSession] updateRoutePoint failed", serializeError(caughtError));
  }
}

async function deleteRoutePoint(routePointId: string) {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  if (!previous.some(point => point.id === routePointId))
    return;

  pointsByVariantId.value = {
    ...pointsByVariantId.value,
    [variantId]: previous.filter(point => point.id !== routePointId),
  };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/point/${encodeURIComponent(routePointId)}`, {
      method: "DELETE",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      query: { variantId },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось удалить точку.";
    console.error("[useAiRouteSession] deleteRoutePoint failed", serializeError(caughtError));
  }
}

async function clearActivePoints() {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  if (!previous.length)
    return;

  pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: [] };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/points/clear`, {
      method: "POST",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      body: { variantId },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось очистить точки.";
    console.error("[useAiRouteSession] clearActivePoints failed", serializeError(caughtError));
  }
}
```

3d. Export them in the `useAiRouteSession` return object:

```ts
    saveRoutePointToDiary,
    updateRoutePoint,
    deleteRoutePoint,
    clearActivePoints,
    setActiveVariant,
```

**Step 4: Run** the test (PASS) and `pnpm lint:source`.

**Step 5: Commit**

```bash
git add composables/use-ai-route-session.ts tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): optimistic client edit/delete/clear for route points"
```

---

## Task 5: Edit-mode composable

**Files:**
- Create: `composables/use-route-edit-mode.ts`
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append):

```js
const editModeSource = await readFile("composables/use-route-edit-mode.ts", "utf8").catch(() => "");

test("route edit mode composable manages an isEditMode toggle", () => {
  assert.match(editModeSource, /export function useRouteEditMode/);
  assert.match(editModeSource, /isEditMode/);
  assert.match(editModeSource, /function toggleEditMode/);
  assert.match(editModeSource, /function setEditMode/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** `composables/use-route-edit-mode.ts`:

```ts
// Module-level state so the toggle control, the map page, and the marker drag
// handler all share one edit-mode flag — mirrors useUserRoutePoints' add-mode.
const isEditMode = ref(false);

function setEditMode(enabled: boolean) {
  isEditMode.value = enabled;
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value;
}

export function useRouteEditMode() {
  return {
    isEditMode,
    setEditMode,
    toggleEditMode,
  };
}
```

**Step 4: Run** (PASS) + `pnpm lint:source`.

**Step 5: Commit**

```bash
git add composables/use-route-edit-mode.ts tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add edit-mode composable"
```

---

## Task 6: Mapbox draggable markers

**Files:**
- Modify: `composables/use-mapbox.ts`
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Context — READ FIRST:** Open `composables/use-mapbox.ts` and study `enablePointPlacement` / `disablePointPlacement` and the marker-creation inside `addMarkers` (the same functions asserted in `tests/server/explore-manual-points.test.mjs`). Mirror that exact style (module-scoped handler refs, `map` access, cleanup on disable).

**Goal:** Add `enableMarkerDragging(onDragEnd)` and `disableMarkerDragging()`. When enabled, generated-stop markers are created/flagged with Mapbox's `draggable: true`; on `dragend` the handler reports the marker's `sourceId` (route point id) and new `{ lng, lat }`. When disabled, markers return to non-draggable. Re-use the existing marker registry that `addMarkers`/`clearMarkers` maintain.

**Step 1: Add failing assertions** (append):

```js
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");

test("mapbox composable supports marker dragging in edit mode", () => {
  assert.match(mapboxSource, /function enableMarkerDragging/);
  assert.match(mapboxSource, /function disableMarkerDragging/);
  assert.match(mapboxSource, /dragend/);
  assert.match(mapboxSource, /draggable/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement.** The registry is `const activeMarkerMap = new Map<string, MarkerEntry>()` keyed by `point.id` (e.g. `generated-<routePointId>`); the route point id is `point.sourceId`. Markers are created with `new mb.Marker({ element })`. Make these concrete changes:

3a. Extend the `MarkerEntry` type with the point and a drag detacher:

```ts
type MarkerEntry = {
  marker: any;
  element: HTMLDivElement;
  labelElement: HTMLDivElement;
  popup: any | null;
  detachListeners: () => void;
  point: RouteMapPoint;
  detachDrag: () => void;
};
```

3b. Add module-scoped state next to `pointPlacementHandler`:

```ts
let markerDragHandler: ((routePointId: string, lngLat: { lng: number; lat: number }) => void) | null = null;
```

3c. Add a drag binder (near `bindMarkerInteractions`). `dragend` is always bound; it no-ops when the handler is null, so toggling only flips `setDraggable`:

```ts
function bindMarkerDrag(marker: any, point: RouteMapPoint): () => void {
  const onDragEnd = () => {
    if (point.markerKind !== "generated")
      return;
    const lngLat = marker.getLngLat();
    markerDragHandler?.(point.sourceId, { lng: lngLat.lng, lat: lngLat.lat });
  };
  marker.on("dragend", onDragEnd);
  return () => marker.off("dragend", onDragEnd);
}
```

3d. In `addMarkers`:
- Create generated markers draggable when a handler is active:
  `const marker = new mb.Marker({ element, draggable: Boolean(markerDragHandler) && point.markerKind === "generated" })`
- After creating, set `detachDrag: bindMarkerDrag(marker, point)` and `point` on the new `activeMarkerMap.set(point.id, { … })` entry.
- In the **existing**-marker branch, refresh the captured point and rebind drag:
  `existing.point = point; existing.detachDrag(); existing.detachDrag = bindMarkerDrag(existing.marker, point);`

3e. In `clearMarkers` and the stale-marker removal loop in `addMarkers`, also call `entry.detachDrag()` alongside `entry.detachListeners()`.

3f. Add the two functions and export them:

```ts
function enableMarkerDragging(onDragEnd: (routePointId: string, lngLat: { lng: number; lat: number }) => void) {
  markerDragHandler = onDragEnd;
  for (const entry of activeMarkerMap.values()) {
    if (entry.point.markerKind === "generated")
      entry.marker.setDraggable(true);
  }
}

function disableMarkerDragging() {
  markerDragHandler = null;
  for (const entry of activeMarkerMap.values())
    entry.marker.setDraggable(false);
}
```

Add `enableMarkerDragging` and `disableMarkerDragging` to the `return { … }` object, and call `disableMarkerDragging()` inside `destroy()`.

**Step 4: Run** the test (PASS) and `pnpm lint:source`.

**Step 5: Commit**

```bash
git add composables/use-mapbox.ts tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(map): support draggable route markers for edit mode"
```

---

## Task 7: Point editor form component

**Files:**
- Create: `components/explore/route-point-editor.vue`
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append):

```js
const editorSource = await readFile("components/explore/route-point-editor.vue", "utf8").catch(() => "");

test("route point editor emits a patch with editable fields", () => {
  assert.match(editorSource, /defineEmits/);
  assert.match(editorSource, /submit/);
  assert.match(editorSource, /v-model[^\n]*name/);
  assert.match(editorSource, /estimatedDurationMinutes|Длительность/);
  assert.match(editorSource, /day|День/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** `components/explore/route-point-editor.vue` — a compact form seeded from a `RouteMapPoint`, emitting `submit: [patch: RoutePointPatch]` and `cancel: []`. Fields: name (text), estimatedStart (text, e.g. "10:30"), estimatedDurationMinutes (number 15–720), day (number 1–14), rationale (textarea). Only include changed fields in the emitted patch. Match the styling tokens used in `manual-points-control.vue` (`explore-input`, `explore-primary-button`, `explore-text-soft`). Keep coordinates out of this form (those change via drag).

```vue
<script lang="ts" setup>
import type { RoutePointPatch } from "~/lib/ai/route-contract";
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{ point: RouteMapPoint }>();
const emit = defineEmits<{ submit: [patch: RoutePointPatch]; cancel: [] }>();

const name = ref(props.point.name);
const day = ref(props.point.day);
const estimatedStart = ref("");
const estimatedDurationMinutes = ref<number | null>(props.point.estimatedDurationMinutes ?? null);
const rationale = ref(props.point.rationale ?? "");

function buildPatch(): RoutePointPatch {
  const patch: RoutePointPatch = {};
  if (name.value.trim() && name.value !== props.point.name)
    patch.name = name.value.trim();
  if (day.value && day.value !== props.point.day)
    patch.day = day.value;
  if (estimatedStart.value.trim())
    patch.estimatedStart = estimatedStart.value.trim();
  if (estimatedDurationMinutes.value && estimatedDurationMinutes.value !== props.point.estimatedDurationMinutes)
    patch.estimatedDurationMinutes = estimatedDurationMinutes.value;
  if (rationale.value.trim() && rationale.value !== props.point.rationale)
    patch.rationale = rationale.value.trim();
  return patch;
}

function onSubmit() {
  const patch = buildPatch();
  if (Object.keys(patch).length)
    emit("submit", patch);
  else
    emit("cancel");
}
</script>

<template>
  <form class="space-y-2" @submit.prevent="onSubmit">
    <!-- name / estimatedStart / estimatedDurationMinutes / day / rationale inputs
         using explore-input styling; two buttons: Сохранить (submit) + Отмена (emit cancel) -->
  </form>
</template>
```

> Fill in the template inputs with `v-model` bindings for each ref and a Save/Cancel button row. Keep it under ~120 lines.

**Step 4: Run** (PASS) + `pnpm lint:source`.

**Step 5: Commit**

```bash
git add components/explore/route-point-editor.vue tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add point editor form component"
```

---

## Task 8: Edit-mode control (toggle + clear all)

**Files:**
- Create: `components/explore/route-edit-control.vue`
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append):

```js
const controlSource = await readFile("components/explore/route-edit-control.vue", "utf8").catch(() => "");

test("edit control toggles edit mode, clears all, and excludes add-mode", () => {
  assert.match(controlSource, /useRouteEditMode/);
  assert.match(controlSource, /useAiRouteSession/);
  assert.match(controlSource, /clearActivePoints/);
  assert.match(controlSource, /toggleEditMode/);
  // Turning on edit mode turns off the manual add-mode (mutual exclusion).
  assert.match(controlSource, /useUserRoutePoints/);
  assert.match(controlSource, /setAddMode\(false\)/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** `components/explore/route-edit-control.vue`, mirroring `manual-points-control.vue`'s structure (toggle button + popover panel). Behaviour:
- Visible only when `useAiRouteSession().activePoints.value.length > 0`.
- Toggle button "Редактировать маршрут" (active styling when `isEditMode`), showing the point count.
- On enabling edit mode: call `useUserRoutePoints().setAddMode(false)` (mutual exclusion).
- Panel contains a hint ("Перетащите точку, нажмите для правки или удалите ненужные") and an "Очистить всё" button that asks for confirm, then calls `clearActivePoints()` and `setEditMode(false)`.
- Disable actions while `useAiRouteSession().isGenerating.value` is true.

**Step 4: Run** (PASS) + `pnpm lint:source`.

**Step 5: Commit**

```bash
git add components/explore/route-edit-control.vue tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): add edit-mode control with clear-all"
```

---

## Task 9: Wire edit mode into the map page

**Files:**
- Modify: `pages/explore.vue`
- Modify: `components/explore/manual-points-control.vue` (mutual exclusion the other way)
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Context — READ FIRST:** Re-read `pages/explore.vue` — specifically the `watch([userRoutePoints.isAddMode, mapbox.mapLoaded], …)` block that calls `enablePointPlacement`/`disablePointPlacement`, the `addMarkers` options (`onRemoveRequest`, `onMarkerClick`), and the fit-suppression flag `isCarouselDriven`.

**Step 1: Add failing assertions** (append):

```js
const pageSource = await readFile("pages/explore.vue", "utf8");

test("explore page wires edit mode: drag, edit, delete, fit-suppression", () => {
  assert.match(pageSource, /useRouteEditMode/);
  assert.match(pageSource, /enableMarkerDragging/);
  assert.match(pageSource, /updateRoutePoint/);
  assert.match(pageSource, /deleteRoutePoint/);
  assert.match(pageSource, /ExploreRouteEditControl/);
  assert.match(pageSource, /ExploreRoutePointEditor/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement** in `pages/explore.vue`:
- Pull in `const { isEditMode, setEditMode } = useRouteEditMode()` and the new session actions `updateRoutePoint, deleteRoutePoint`.
- Add a `watch([isEditMode, mapbox.mapLoaded], …)` mirroring the placement watch: when edit mode on, `mapbox.enableMarkerDragging((sourceId, lngLat) => updateRoutePoint(sourceId, { coordinates: { lat: lngLat.lat, long: lngLat.lng } }))`; when off, `mapbox.disableMarkerDragging()`.
- Mutual exclusion: when `isEditMode` becomes true, `userRoutePoints.setAddMode(false)`; in the existing add-mode watch, when add-mode becomes true, `setEditMode(false)`.
- Suppress auto-fit while `isEditMode.value` is true (extend the guard that already uses `isCarouselDriven`) so dragging/editing doesn't re-frame the map.
- In `addMarkers` options, when `isEditMode.value`, route the generated marker's remove affordance to `deleteRoutePoint(point.sourceId)` (the existing `onRemoveRequest` currently handles `user-place`; branch by `markerKind`), and add an edit affordance that opens the editor.
- Add local state `const editingPoint = ref<RouteMapPoint | null>(null)` and render `<ExploreRoutePointEditor :point="editingPoint" @submit="onEditSubmit" @cancel="editingPoint = null" />` inside a small popover/sheet; `onEditSubmit(patch)` calls `updateRoutePoint(editingPoint.value.sourceId, patch)` then clears `editingPoint`.
- Mount `<ExploreRouteEditControl />` next to `<ExploreManualPointsControl />` in the bottom-left control stack.
- `onBeforeUnmount`: `setEditMode(false)` and `mapbox.disableMarkerDragging()`.

In `components/explore/manual-points-control.vue`: when enabling add-mode (`toggleAddMode`/placement), also call `useRouteEditMode().setEditMode(false)`.

**Step 4: Run** the test (PASS), `pnpm lint:source`, and `pnpm test:server` (whole suite green except the known pre-existing `results-actions` failure).

**Step 5: Commit**

```bash
git add pages/explore.vue components/explore/manual-points-control.vue tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): wire edit mode (drag/edit/delete) into the map page"
```

---

## Task 10: Mobile parity (bottom sheet edit/delete)

**Files:**
- Modify: `components/explore/place-bottom-sheet.vue`
- Modify: `pages/explore.vue` (handle the new emits)
- Test: `tests/server/edit-ai-route-points.test.mjs`

**Step 1: Add failing assertions** (append):

```js
const sheetSource = await readFile("components/explore/place-bottom-sheet.vue", "utf8");

test("bottom sheet exposes edit and delete for generated points", () => {
  assert.match(sheetSource, /edit:\s*\[point: RouteMapPoint\]|"edit"/);
  assert.match(sheetSource, /delete:\s*\[point: RouteMapPoint\]|"delete"/);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implement.** In `place-bottom-sheet.vue`, add `edit` and `delete` to `defineEmits`, and (only for `markerKind === "generated"` when edit mode is active — pass an `editable` prop from the page) render "Изменить"/"Удалить" buttons in the sheet footer that emit those events with `props.place`. In `pages/explore.vue`, pass `:editable="isEditMode"` and handle `@edit="editingPoint = $event"` and `@delete="deleteRoutePoint($event.sourceId)"`.

**Step 4: Run** (PASS) + `pnpm lint:source`.

**Step 5: Commit**

```bash
git add components/explore/place-bottom-sheet.vue pages/explore.vue tests/server/edit-ai-route-points.test.mjs
git commit -m "feat(route): edit/delete points from the mobile bottom sheet"
```

---

## Task 11: Final verification

**Step 1:** `pnpm lint:source` → clean.

**Step 2:** `pnpm test:server` → all green except the pre-existing `results actions expose a destructive reset control` (unrelated WIP). Confirm `edit-ai-route-points` subtests all pass.

**Step 3 (manual / preview):** With `pnpm dev` and a logged-in session on `/explore`: generate a route, toggle "Редактировать маршрут", drag a marker (persists after reload), edit a point's fields, delete a point, "Очистить всё", and verify edits survive a page reload and appear via the shared `?sessionId=` link.

**Step 4: Commit** any final touch-ups.

```bash
git commit -am "test(route): verify edit-ai-route-points feature"
```

---

## Notes / deferred
- Adding new points and intra-day reordering are intentionally out of scope (see design doc).
- Editing a point keeps its cached place-intelligence (keyed by point id) — minor staleness after a move is accepted; delete cleans up `routePlaceStory`.
- Editing mutates the active variant in place; regenerating/refining still creates a new variant.
