# Shared route — public read-only view — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/explore?sessionId=N` open the route for any visitor, including unauthenticated ones, while preserving owner-only privacy for the existing private endpoint.

**Architecture:** A new public Nitro handler `GET /api/ai/route/[session-id]/shared` returns a sanitized snapshot using a new owner-agnostic DB query. The client composable `useAiRouteSession` falls back to the public endpoint on 401/403/404 from the private one and exposes an `isReadOnly` flag. UI surfaces (route panel, top action chips, place popup/bottom sheet, step carousel) hide write actions in read-only mode and show a sign-in CTA.

**Tech Stack:** Nuxt 3 + Nitro, Drizzle ORM (libSQL), Vue 3 SFCs, `node:test` source-structure assertions (see `tests/server/*.test.mjs` pattern).

**Design doc:** [docs/plans/2026-05-25-shared-route-public-view-design.md](2026-05-25-shared-route-public-view-design.md)

**Repo conventions:**
- All commits authored as `sad1k <misha.kirillov.0990@gmail.com>` (no AI co-author footer).
- `pnpm lint:source` MUST be green before each commit; treat lint failures as blockers.
- Tests live in `tests/server/*.test.mjs`. They read source files and assert regex patterns, not HTTP. Run via `pnpm test:server`. The full verify gate is `pnpm verify:explore-foundation` (lint + tests).

---

## Task 1: Public DB query — `findAiRouteSessionByIdPublic`

**Files:**
- Modify: `lib/db/queries/ai-route.ts`
- Test: `tests/server/shared-route-snapshot.test.mjs` (new)

### Step 1: Write the failing structure test

Create `tests/server/shared-route-snapshot.test.mjs`:

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const queriesSource = await readFile("lib/db/queries/ai-route.ts", "utf8");

test("ai-route queries expose owner-agnostic public lookup", () => {
  assert.match(queriesSource, /export async function findAiRouteSessionByIdPublic\(sessionId: number\)/);
  // public query MUST NOT filter by userId
  const publicBody = queriesSource.match(
    /export async function findAiRouteSessionByIdPublic[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert.ok(publicBody, "findAiRouteSessionByIdPublic body must be present");
  assert.doesNotMatch(publicBody, /aiRouteSession\.userId/);
  // public query MUST NOT pull events or messages (not needed by snapshot)
  assert.doesNotMatch(publicBody, /events:/);
  assert.doesNotMatch(publicBody, /messages:/);
  // and MUST keep variants + points so the snapshot is renderable
  assert.match(publicBody, /variants:/);
  assert.match(publicBody, /points:/);
});

test("ai-route owner-only query remains user-scoped", () => {
  const ownerBody = queriesSource.match(
    /export async function findAiRouteSessionByIdForUser[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert.ok(ownerBody, "findAiRouteSessionByIdForUser body must be present");
  assert.match(ownerBody, /eq\(aiRouteSession\.userId, userId\)/);
});
```

### Step 2: Run the test — confirm it fails

```
pnpm test:server -- --test-name-pattern "owner-agnostic public lookup"
```

Expected: FAIL — `findAiRouteSessionByIdPublic` does not exist yet.

### Step 3: Implement the query

In `lib/db/queries/ai-route.ts`, immediately below `findAiRouteSessionByIdForUser`, add:

```ts
export async function findAiRouteSessionByIdPublic(sessionId: number) {
  return db.query.aiRouteSession.findFirst({
    where: eq(aiRouteSession.id, sessionId),
    with: {
      variants: {
        orderBy: [desc(aiRouteVariant.updateAt)],
        with: {
          points: {
            orderBy: [aiRoutePoint.day, aiRoutePoint.sequence],
          },
        },
      },
    },
  });
}
```

No `messages`, no `events`, no `userId` filter.

### Step 4: Re-run the test — confirm green

```
pnpm test:server -- --test-name-pattern "ai-route"
```

Expected: PASS for both tests in Task 1.

### Step 5: Lint and commit

```
pnpm lint:source
git add lib/db/queries/ai-route.ts tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(ai-route): add owner-agnostic public route session query"
```

---

## Task 2: Public endpoint — `GET /api/ai/route/[session-id]/shared`

**Files:**
- Create: `server/api/ai/route/[session-id]/shared.get.ts`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Extend the test file

Append to `tests/server/shared-route-snapshot.test.mjs`:

```js
const sharedHandlerSource = await readFile(
  "server/api/ai/route/[session-id]/shared.get.ts",
  "utf8",
);

test("shared route handler is publicly readable", () => {
  // does NOT use the authenticated wrapper
  assert.doesNotMatch(sharedHandlerSource, /defineAuthenticatedHandler/);
  assert.match(sharedHandlerSource, /export default defineEventHandler/);
  // delegates to the public query
  assert.match(sharedHandlerSource, /findAiRouteSessionByIdPublic/);
  assert.doesNotMatch(sharedHandlerSource, /findAiRouteSessionByIdForUser/);
});

test("shared route handler returns a sanitized snapshot", () => {
  // sanitized snapshot — these MUST NOT leak
  assert.doesNotMatch(sharedHandlerSource, /requestContext:/);
  assert.doesNotMatch(sharedHandlerSource, /events:/);
  assert.doesNotMatch(sharedHandlerSource, /diarySave/);
  assert.doesNotMatch(sharedHandlerSource, /failureCode/);
  assert.doesNotMatch(sharedHandlerSource, /failureStage/);
  assert.doesNotMatch(sharedHandlerSource, /notificationStatus/);
  assert.doesNotMatch(sharedHandlerSource, /generationStartedAt/);
  // but it MUST expose the renderable fields
  assert.match(sharedHandlerSource, /sessionId: session\.id/);
  assert.match(sharedHandlerSource, /activeVariantId: session\.activeVariantId/);
  assert.match(sharedHandlerSource, /cityName: session\.cityName/);
  assert.match(sharedHandlerSource, /selectedDays:/);
  assert.match(sharedHandlerSource, /pointsByVariantId:/);
  assert.match(sharedHandlerSource, /variants: session\.variants\.map/);
});

test("shared route handler validates session id and 404s on missing", () => {
  assert.match(sharedHandlerSource, /Некорректный ID сессии маршрута/);
  assert.match(sharedHandlerSource, /Маршрут не найден/);
  assert.match(sharedHandlerSource, /statusCode: 400/);
  assert.match(sharedHandlerSource, /statusCode: 404/);
});

test("private route handler stays owner-only", () => {
  const privateHandler = await readFile(
    "server/api/ai/route/[session-id].get.ts",
    "utf8",
  );
  assert.match(privateHandler, /defineAuthenticatedHandler/);
  assert.match(privateHandler, /findAiRouteSessionByIdForUser/);
});
```

(The last test is async — wrap the body in `async () => {}`.)

### Step 2: Run — confirm failures

```
pnpm test:server -- --test-name-pattern "shared route handler"
```

Expected: FAIL — `server/api/ai/route/[session-id]/shared.get.ts` does not exist.

### Step 3: Implement the endpoint

Create `server/api/ai/route/[session-id]/shared.get.ts`:

```ts
import type { RoutePoint } from "~/lib/ai/route-contract";

import {
  ExploreRequestContextSchema,
  RoutePointSchema,
} from "~/lib/ai/route-contract";
import { findAiRouteSessionByIdPublic } from "~/lib/db/queries/ai-route";

type SharedRouteSessionStatus = "generating" | "completed" | "failed";

export default defineEventHandler(async (event) => {
  const sessionId = parseSessionId(getRouterParam(event, "session-id"));
  const session = await findAiRouteSessionByIdPublic(sessionId);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Маршрут не найден",
    });
  }

  return {
    sessionId: session.id,
    status: normalizeStatus(session.status),
    activeVariantId: session.activeVariantId,
    cityName: session.cityName,
    selectedDays: parseSelectedDays(session.requestContextJson),
    variants: session.variants.map(variant => ({
      id: variant.id,
      parentVariantId: variant.parentVariantId ?? undefined,
      status: normalizeStatus(variant.status),
      title: variant.title ?? undefined,
      summary: variant.summary ?? undefined,
      pointCount: variant.points.length,
    })),
    pointsByVariantId: Object.fromEntries(
      session.variants.map(variant => [
        variant.id,
        variant.points
          .map(toRoutePoint)
          .filter((point): point is RoutePoint => point !== null),
      ]),
    ),
  };
});

function parseSessionId(input: string | undefined) {
  const sessionId = Number(input);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Некорректный ID сессии маршрута",
    });
  }
  return sessionId;
}

function normalizeStatus(input: string): SharedRouteSessionStatus {
  if (input === "completed" || input === "failed")
    return input;
  return "generating";
}

function parseSelectedDays(input: string) {
  const parsed = parseJson(input);
  const context = ExploreRequestContextSchema.safeParse(parsed);
  return context.success ? context.data.selectedDays : null;
}

function toRoutePoint(point: {
  routePointId: string;
  name: string;
  day: number;
  lat: number;
  long: number;
  estimatedStart: string | null;
  estimatedDurationMinutes: number | null;
  rationale: string;
  confidence: string;
  alternativeForPointId: string | null;
  approximateDistanceMeters: number | null;
  estimatedPriceLevel: string | null;
  priceConfidence: string | null;
  priceSource: string | null;
}): RoutePoint | null {
  const parsed = RoutePointSchema.safeParse({
    id: point.routePointId,
    name: point.name,
    day: point.day,
    coordinates: { lat: point.lat, long: point.long },
    estimatedStart: point.estimatedStart ?? undefined,
    estimatedDurationMinutes: point.estimatedDurationMinutes ?? undefined,
    rationale: point.rationale,
    confidence: point.confidence,
    alternativeForPointId: point.alternativeForPointId ?? undefined,
    approximateDistanceMeters: point.approximateDistanceMeters ?? undefined,
    estimatedPriceLevel: point.estimatedPriceLevel ?? undefined,
    priceConfidence: point.priceConfidence ?? undefined,
    priceSource: point.priceSource ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

function parseJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  }
  catch {
    return null;
  }
}
```

### Step 4: Re-run — confirm green

```
pnpm test:server -- --test-name-pattern "shared route handler|private route handler"
```

Expected: PASS for all four tests.

### Step 5: Lint and commit

```
pnpm lint:source
git add server/api/ai/route/[session-id]/shared.get.ts tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(ai-route): add public shared route session endpoint"
```

---

## Task 3: Composable — `isReadOnly` + public fallback

**Files:**
- Modify: `composables/use-ai-route-session.ts`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Write the failing structure test

Append to `tests/server/shared-route-snapshot.test.mjs`:

```js
const composableSource = await readFile(
  "composables/use-ai-route-session.ts",
  "utf8",
);

test("useAiRouteSession exposes a read-only flag derived from fetch outcome", () => {
  assert.match(composableSource, /const isReadOnly = ref\(false\)/);
  // returned from the composable
  assert.match(composableSource, /return \{[\s\S]*\bisReadOnly\b[\s\S]*\}/);
  // reset on session reset
  const resetBody = composableSource.match(
    /function resetRouteSession\(\)[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert.match(resetBody, /isReadOnly\.value = false/);
});

test("restoreRouteSession falls back to the public endpoint on 401/403/404", () => {
  const body = composableSource.match(
    /async function restoreRouteSession[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert.ok(body, "restoreRouteSession body must be present");
  assert.match(body, /loadSharedRouteSessionSnapshot/);
  assert.match(body, /applySharedRouteSessionSnapshot/);
  assert.match(body, /isReadOnly\.value = false/);
  assert.match(body, /isReadOnly\.value = true/);
  // narrow fallback — network/5xx must NOT trigger it
  assert.match(body, /status !== 401 && status !== 403 && status !== 404/);
});

test("write actions are gated on isReadOnly client-side", () => {
  for (const fn of ["generateRoute", "submitFollowUp", "saveRoutePointToDiary"]) {
    const body = composableSource.match(
      new RegExp(`async function ${fn}[\\s\\S]*?^}`, "m"),
    )?.[0] ?? "";
    assert.ok(body, `${fn} body must be present`);
    assert.match(body, /if \(isReadOnly\.value\)\s+return/);
  }
});

test("applySharedRouteSessionSnapshot clears owner-only state", () => {
  const body = composableSource.match(
    /function applySharedRouteSessionSnapshot[\s\S]*?^}/m,
  )?.[0] ?? "";
  assert.ok(body, "applySharedRouteSessionSnapshot body must be present");
  assert.match(body, /lastRequestContext\.value = null/);
  assert.match(body, /events\.value = \[\]/);
});
```

### Step 2: Run — confirm failures

```
pnpm test:server -- --test-name-pattern "useAiRouteSession|restoreRouteSession|write actions|applySharedRouteSessionSnapshot"
```

Expected: all four FAIL.

### Step 3: Implement

In `composables/use-ai-route-session.ts`:

1. **Add the ref next to the other top-level refs**:

```ts
const isReadOnly = ref(false);
```

2. **Add a public snapshot loader** next to `loadRouteSessionSnapshot`:

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

async function loadSharedRouteSessionSnapshot(nextSessionId: number) {
  return $fetch<SharedRouteSessionSnapshot>(`/api/ai/route/${nextSessionId}/shared`);
}

function applySharedRouteSessionSnapshot(snapshot: SharedRouteSessionSnapshot) {
  sessionId.value = snapshot.sessionId;
  activeVariantId.value = snapshot.activeVariantId ?? snapshot.variants[0]?.id ?? null;
  variants.value = snapshot.variants.map(variant => ({
    id: variant.id,
    parentVariantId: variant.parentVariantId,
    status: variant.status,
    title: variant.title,
    summary: variant.summary,
    pointCount: variant.pointCount,
  }));
  events.value = [];
  pointsByVariantId.value = snapshot.pointsByVariantId;
  lastRequestContext.value = null;
  isGenerating.value = false;
  error.value = null;
  lastWarning.value = null;
  persistRouteSessionReference(snapshot.sessionId);
}
```

3. **Replace `restoreRouteSession`**:

```ts
async function restoreRouteSession(explicitSessionId?: number) {
  if (!import.meta.client)
    return;

  const nextSessionId = explicitSessionId ?? readStoredRouteSessionId();
  if (!nextSessionId || (!explicitSessionId && sessionId.value))
    return;

  try {
    const snapshot = await loadRouteSessionSnapshot(nextSessionId);
    applyRouteSessionSnapshot(snapshot);
    isReadOnly.value = false;
    return;
  }
  catch (caughtError) {
    const status = readStatusCode(caughtError);
    if (status !== 401 && status !== 403 && status !== 404) {
      console.error("[useAiRouteSession] Route session restore failed", {
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
    console.error("[useAiRouteSession] Shared route session restore failed", {
      error: serializeError(caughtError),
      storedSessionId: nextSessionId,
      ...getClientDiagnosticContext(),
    });
    persistRouteSessionReference(null);
  }
}

function readStatusCode(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null)
    return undefined;
  const record = input as Record<string, unknown>;
  if (typeof record.statusCode === "number")
    return record.statusCode;
  if (typeof record.status === "number")
    return record.status;
  return undefined;
}
```

4. **Gate write actions** by adding the early return at the top of `generateRoute`, `submitFollowUp`, and `saveRoutePointToDiary`:

```ts
async function generateRoute(requestContext: ExploreRequestContext) {
  if (isReadOnly.value)
    return;
  resetRouteSession();
  // ... existing body
}

async function submitFollowUp(followUpMessage: string) {
  if (isReadOnly.value)
    return;
  const message = followUpMessage.trim();
  // ... existing body
}

async function saveRoutePointToDiary(routePointId: string) {
  if (isReadOnly.value)
    return;
  if (!sessionId.value || !activeVariantId.value)
    return;
  // ... existing body
}
```

5. **Reset the flag in `resetRouteSession`**:

```ts
function resetRouteSession() {
  sessionId.value = null;
  activeVariantId.value = null;
  variants.value = [];
  events.value = [];
  pointsByVariantId.value = {};
  isGenerating.value = false;
  error.value = null;
  lastWarning.value = null;
  lastRequestContext.value = null;
  isReadOnly.value = false;
  persistRouteSessionReference(null);
}
```

6. **Return the new flag** from `useAiRouteSession`:

```ts
return {
  sessionId,
  activeVariantId,
  variants,
  events,
  pointsByVariantId,
  activePoints,
  isGenerating,
  isReadOnly,
  error,
  lastWarning,
  generateRoute,
  submitFollowUp,
  saveRoutePointToDiary,
  setActiveVariant,
  restoreRouteSession,
  resetRouteSession,
};
```

### Step 4: Re-run — confirm green

```
pnpm test:server -- --test-name-pattern "useAiRouteSession|restoreRouteSession|write actions|applySharedRouteSessionSnapshot"
pnpm test:server
```

Expected: all green.

### Step 5: Lint and commit

```
pnpm lint:source
git add composables/use-ai-route-session.ts tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): add isReadOnly + public fallback to ai route session composable"
```

---

## Task 4: Route panel — read-only branch

**Files:**
- Modify: `components/explore/route-panel.vue`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Test

Append:

```js
const routePanelSource = await readFile(
  "components/explore/route-panel.vue",
  "utf8",
);

test("route panel hides wizard inputs when isReadOnly", () => {
  // wizard inputs gated by !isReadOnly
  for (const block of ["ExploreCityTypeahead", "Длительность", "Интересы", "Способ передвижения"]) {
    const escaped = block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      routePanelSource,
      new RegExp(`v-if="!isReadOnly[\\s\\S]{0,800}${escaped}|${escaped}[\\s\\S]{0,400}v-if="!isReadOnly`),
      `expected ${block} section to be gated by !isReadOnly`,
    );
  }
});

test("route panel hides history and follow-up when isReadOnly", () => {
  assert.match(
    routePanelSource,
    /<ExploreRouteHistory[\s\S]*?v-if="!isReadOnly|v-if="!isReadOnly[\s\S]{0,200}<ExploreRouteHistory/,
  );
  assert.match(
    routePanelSource,
    /<ExploreRouteFollowUp[\s\S]*?v-if="!isReadOnly|v-if="!isReadOnly[\s\S]{0,200}<ExploreRouteFollowUp/,
  );
});

test("route panel shows sign-in CTA in footer when isReadOnly", () => {
  assert.match(routePanelSource, /isReadOnly/);
  // a sign-in CTA replaces the generate/save/share footer
  assert.match(routePanelSource, /Войти, чтобы спланировать свой/);
});
```

### Step 2: Run — confirm failures

```
pnpm test:server -- --test-name-pattern "route panel"
```

Expected: FAIL.

### Step 3: Implement

In `components/explore/route-panel.vue`:

1. **Destructure `isReadOnly`** from `useAiRouteSession()`:

```ts
const aiRouteSession = useAiRouteSession();
const isReadOnly = aiRouteSession.isReadOnly;
```

2. **Adjust header copy**:

```vue
<p class="explore-section-label text-[10px] font-bold uppercase tracking-[0.34em]">
  {{ isReadOnly ? "Маршрут от другого пользователя" : "AI-планировщик маршрута" }}
</p>
<h2 v-if="!isReadOnly" class="explore-text mt-3 text-[24px] font-semibold leading-tight tracking-tight">
  Соберём <span class="explore-accent-text">идеальный</span> день
</h2>
<h2 v-else class="explore-text mt-3 text-[24px] font-semibold leading-tight tracking-tight">
  Чужой маршрут — <span class="explore-accent-text">только просмотр</span>
</h2>
```

3. **Gate the four wizard sections** with `v-if="!isReadOnly"` on each `<section>` (city typeahead, days, interests, transport).

4. **Gate** `<ExploreRouteHistory />` and `<ExploreRouteFollowUp />` inside the route-session block with `v-if="!isReadOnly"`.

5. **Footer** — wrap existing footer in `v-if="!isReadOnly"`, add the CTA alternative:

```vue
<footer
  v-if="!isPanelCollapsed && !isReadOnly"
  class="explore-panel-divider flex items-center gap-2 border-t px-5 py-4"
>
  <!-- existing buttons -->
</footer>
<footer
  v-else-if="!isPanelCollapsed && isReadOnly"
  class="explore-panel-divider flex flex-col gap-2 border-t px-5 py-4"
>
  <NuxtLink
    class="explore-primary-button flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-[12.5px] font-bold tracking-wide shadow-lg shadow-brand-emerald/25 transition"
    to="/"
  >
    <Icon name="tabler:login-2" size="15" />
    <span>Войти, чтобы спланировать свой</span>
  </NuxtLink>
</footer>
```

**NB:** The exact sign-in path used by `AppUserMenu` may differ from `/`. Before implementing, open `components/app/user-menu.vue` (or wherever the sign-in CTA lives) and reuse the same target. If it's a programmatic call (e.g. `auth.signIn.social(...)`), wrap the CTA in a `@click` handler that triggers the same flow. The test does not check the path, only the CTA copy.

### Step 4: Re-run — confirm green

```
pnpm test:server -- --test-name-pattern "route panel"
```

### Step 5: Lint and commit

```
pnpm lint:source
git add components/explore/route-panel.vue tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): gate wizard inputs and footer behind isReadOnly in route panel"
```

---

## Task 5: Top action chips — `results-actions.vue`

**Files:**
- Modify: `components/explore/results-actions.vue`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Test

Append:

```js
const resultsActionsSource = await readFile(
  "components/explore/results-actions.vue",
  "utf8",
);

test("results-actions hides write/personal buttons in isReadOnly", () => {
  assert.match(resultsActionsSource, /isReadOnly/);
  for (const popoverKey of ["'weather'", "'history'", "'followUp'"]) {
    const escaped = popoverKey.replace(/'/g, "\\'");
    assert.match(
      resultsActionsSource,
      new RegExp(`v-if="!isReadOnly[\\s\\S]{0,400}${escaped}|${escaped}[\\s\\S]{0,400}v-if="!isReadOnly`),
      `expected popover ${popoverKey} to be gated`,
    );
  }
  // share button stays unconditionally available
  assert.match(resultsActionsSource, /aria-label="Share"[\s\S]{0,400}toggle\('share'\)/);
});
```

### Step 2: Run — confirm failure

```
pnpm test:server -- --test-name-pattern "results-actions"
```

### Step 3: Implement

1. Destructure `isReadOnly` from `useAiRouteSession()`.
2. On the three `<div class="relative">` wrappers for the `weather`, `history`, and `followUp` buttons, add `v-if="!isReadOnly"`. The Share button wrapper stays unconditional.

### Step 4: Re-run

```
pnpm test:server -- --test-name-pattern "results-actions"
```

### Step 5: Lint and commit

```
pnpm lint:source
git add components/explore/results-actions.vue tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): hide non-share top actions in shared read-only view"
```

---

## Task 6: Place popup — `includeSaveCta` option

**Files:**
- Modify: `components/explore/place-popup.ts`
- Modify: `pages/explore.vue`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Test

Append:

```js
const placePopupSource = await readFile(
  "components/explore/place-popup.ts",
  "utf8",
);
const explorePageSource = await readFile("pages/explore.vue", "utf8");

test("place popup supports includeSaveCta option", () => {
  assert.match(placePopupSource, /includeSaveCta/);
  // save-cta HTML only emitted when option is true
  assert.match(placePopupSource, /includeSaveCta\s*\?\s*[\s\S]{0,200}save|if \(includeSaveCta\)/);
});

test("explore page passes !isReadOnly into popup builder", () => {
  assert.match(
    explorePageSource,
    /createPlacePopupHTML\([\s\S]{0,200}includeSaveCta:\s*!isReadOnly/,
  );
  assert.match(
    explorePageSource,
    /createPlacePopupHTML\([\s\S]{0,200}includeStoryCta:\s*!isReadOnly/,
  );
});
```

### Step 2: Run — confirm failure

```
pnpm test:server -- --test-name-pattern "place popup|popup builder"
```

### Step 3: Implement

1. **`components/explore/place-popup.ts`** — extend the options type and gate the save-CTA HTML emission on `includeSaveCta` (default `true`). Inspect the file first; the existing `includeStoryCta` option is a model for the new flag. Use the exact same conditional pattern.

2. **`pages/explore.vue`** — in the `getPopupHTML` callback inside the `mapbox.addMarkers` call, pass:

```ts
async getPopupHTML(point) {
  if (point.markerKind !== "generated")
    return "";
  const intelligence = await placeIntelligence.loadForRoutePoint(point, activeVariantId.value);
  return createPlacePopupHTML(intelligence, {
    includeStoryCta: !isReadOnly.value,
    includeSaveCta: !isReadOnly.value,
  });
},
```

Destructure `isReadOnly` from `useAiRouteSession()` at the top of the script.

### Step 4: Re-run

```
pnpm test:server -- --test-name-pattern "place popup|popup builder"
```

### Step 5: Lint and commit

```
pnpm lint:source
git add components/explore/place-popup.ts pages/explore.vue tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): make popup save CTA optional and hide it in shared view"
```

---

## Task 7: Bottom sheet — hide save and story CTAs

**Files:**
- Modify: `components/explore/place-bottom-sheet.vue` (locate the actual filename; the page references `<ExplorePlaceBottomSheet>` — file may be `place-bottom-sheet.vue` or similar)
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Locate the file

```
Glob: components/explore/**/*bottom-sheet*.vue
```

Use the exact path returned.

### Step 2: Test

Append (use the resolved path):

```js
const placeBottomSheetSource = await readFile(
  "<RESOLVED_PATH>",
  "utf8",
);

test("place bottom sheet hides save and story CTAs in isReadOnly", () => {
  assert.match(placeBottomSheetSource, /isReadOnly/);
  // both save and story emit events that require auth — gate them
  for (const eventName of ["save", "story"]) {
    assert.match(
      placeBottomSheetSource,
      new RegExp(`@click=[^\\n]*${eventName}\\b[\\s\\S]{0,400}v-if="!isReadOnly|v-if="!isReadOnly[\\s\\S]{0,400}@click=[^\\n]*${eventName}\\b`),
      `expected ${eventName} action to be gated by !isReadOnly`,
    );
  }
});
```

### Step 3: Run — confirm failure

```
pnpm test:server -- --test-name-pattern "place bottom sheet"
```

### Step 4: Implement

Destructure `isReadOnly` from `useAiRouteSession()`. Wrap (or `v-if`) the save and story action buttons with `!isReadOnly`. Keep the directions button unconditional.

### Step 5: Re-run

```
pnpm test:server -- --test-name-pattern "place bottom sheet"
```

### Step 6: Lint and commit

```
pnpm lint:source
git add <RESOLVED_PATH> tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): hide save/story CTAs in place bottom sheet for shared view"
```

---

## Task 8: Step carousel — hide per-point save

**Files:**
- Modify: `components/explore/route-step-carousel.vue`
- Modify: `tests/server/shared-route-snapshot.test.mjs`

### Step 1: Test

Append:

```js
const stepCarouselSource = await readFile(
  "components/explore/route-step-carousel.vue",
  "utf8",
);

test("route step carousel hides per-point save in isReadOnly", () => {
  assert.match(stepCarouselSource, /isReadOnly/);
  assert.match(
    stepCarouselSource,
    /@click=[^\n]*save\b[\s\S]{0,400}v-if="!isReadOnly|v-if="!isReadOnly[\s\S]{0,400}@click=[^\n]*save\b/,
  );
});
```

### Step 2: Run — confirm failure

```
pnpm test:server -- --test-name-pattern "route step carousel"
```

### Step 3: Implement

Destructure `isReadOnly` from `useAiRouteSession()`. Wrap the save button (and any "add to diary" CTA) in `v-if="!isReadOnly"`. Open the file first to find the exact save-button markup.

### Step 4: Re-run

```
pnpm test:server -- --test-name-pattern "route step carousel"
```

### Step 5: Lint and commit

```
pnpm lint:source
git add components/explore/route-step-carousel.vue tests/server/shared-route-snapshot.test.mjs
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "feat(explore): hide per-point save in step carousel for shared view"
```

---

## Task 9: Full verification gate

### Step 1: Lint + tests

```
pnpm verify:explore-foundation
```

Expected: PASS for both lint and `test:server`.

### Step 2: Typecheck

```
pnpm typecheck
```

Expected: no new errors in any touched file. If existing pre-WIP files report errors unrelated to this change, leave them alone.

### Step 3: No additional commit needed if Step 1 and Step 2 are green.

---

## Task 10: Manual verification — read-only path works in browser

**Reference:** [run](skills/run) — launch the project's dev server.

### Step 1: Boot the dev server

```
pnpm dev
```

(or whatever start command is documented in `CLAUDE.md`/README).

### Step 2: As an authenticated user

1. Sign in.
2. Generate a route (or open an existing session) in `/explore`.
3. Click the Share button → copy the URL. Confirm the URL pattern is `/explore?sessionId=<N>`.

### Step 3: As an anonymous visitor

1. Open the copied URL in a new private/incognito window.
2. Wait for the map to load.

**Expected:**
- Route line and pins render on the map.
- Right-hand panel shows the route stats, day selector, and place list.
- Wizard inputs (city, days, interests, transport) are hidden.
- Footer shows "Войти, чтобы спланировать свой" instead of generate/save/share buttons.
- Top-right chips: only the Share icon is visible.
- Clicking a pin opens the bottom sheet with directions but no Save/Story buttons.
- Browser console shows no 401s from the public path; private endpoint 401 is silent.

### Step 4: Regression — owner experience

1. Reload the same URL while signed in as the route owner.
2. Confirm all owner-side controls are back (generate, save, follow-up, history, weather, diary pill).
3. Confirm the diary save flow still works end-to-end.

### Step 5: Capture screenshots

Save before (owner) and after (anon) screenshots into the conversation as evidence. If anything regresses, fix on the relevant Task above and rerun `pnpm verify:explore-foundation`.

### Step 6: Final commit (only if Step 5 required fixes)

```
pnpm lint:source
git add <changed files>
git commit --author="sad1k <misha.kirillov.0990@gmail.com>" -m "fix(explore): <specific regression you fixed>"
```

---

## Out of scope (do not implement here)

- Opaque share tokens (replace sequential IDs with nanoid). New task.
- Public versions of `place-intelligence`, `weather-tips`, `place-story`. New task.
- "Shared by X" attribution in the panel. New task.
- Analytics for non-owner views. New task.

## Plan complete

After Task 10 passes manually, the share-link UX matches the design doc and the regression suite via `pnpm verify:explore-foundation` provides the safety net for future changes.
