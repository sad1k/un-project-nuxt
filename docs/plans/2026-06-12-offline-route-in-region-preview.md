# Offline Route in Region Preview — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Сделать так, чтобы офлайн-превью региона отвечало на вопрос «куда идти»: сохранять точки маршрута и дорожную геометрию при скачивании, рендерить линию + нумерованные маркеры + список точек в превью.

**Architecture:** Точки маршрута (`RouteMapPoint[]`) и однократно снятая геометрия Mapbox Directions сохраняются прямо в записи `OfflineRegion` (IndexedDB безсхемный — без бампа версии). Превью добавляет GeoJSON-линию (фоллбек — прямые отрезки) и HTML-маркеры/попапы из `route-marker.ts` (глифы не нужны), плюс колонку со списком точек по дням. Старые регионы без точек деградируют до текущего поведения.

**Tech Stack:** Nuxt 3, Vue 3, MapLibre GL 4.7.1, Mapbox Directions API, IndexedDB, node:test (раннер `scripts/run-node-tests.mjs`).

**Reference:** [docs/plans/2026-06-12-offline-route-in-region-preview-design.md](2026-06-12-offline-route-in-region-preview-design.md)

**Тесты:** все source-level (читают исходники и проверяют паттерны — установленный стиль `tests/server/pwa-*.test.mjs`, `offline-region-preview.test.mjs`), один растущий файл `tests/server/offline-route-preview.test.mjs`. Прямой запуск TS-модулей в node:test в этом репо не используется.

---

## Pre-flight

Run: `git status && git log --oneline -2`

Expected: ветка `main` (рабочий паттерн этого репо — коммиты в main), последние коммиты — дизайн-док `docs(offline): design for route display…` и этот план. Untracked `.agents/`, `composables/use-user-route-points.ts.bak`, `skills-lock.json` не трогать и не коммитить.

---

### Task 1: Извлечь fetcher дорожной геометрии в `lib/explore/road-route.ts`

Сейчас `fetchMapboxRoadRouteCoordinates` — приватная функция модуля `composables/use-mapbox.ts:83-129`, использующая module-level `mapboxAccessToken` (use-mapbox.ts:39). Офлайн-флоу не может её переиспользовать. Извлекаем в общий модуль с токеном-параметром.

**Files:**
- Create: `lib/explore/road-route.ts`
- Modify: `composables/use-mapbox.ts` (строки 11-12, 83-129, ~640)
- Create: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Create `tests/server/offline-route-preview.test.mjs`:

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("road route fetcher is shared, not private to use-mapbox", async () => {
  // The offline download flow must capture the road-following line while
  // online. The fetcher lives in use-mapbox as a module-private function
  // bound to module state (mapboxAccessToken) — extract it to a lib module
  // that takes the token as a parameter.
  const roadRouteSource = await readFile("lib/explore/road-route.ts", "utf8");
  assert.match(roadRouteSource, /export async function fetchMapboxRoadRouteCoordinates/);
  assert.match(roadRouteSource, /export const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25/);
  assert.match(roadRouteSource, /accessToken: string/);

  const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
  assert.match(
    mapboxSource,
    /import \{ fetchMapboxRoadRouteCoordinates \} from "~\/lib\/explore\/road-route"/,
  );
  assert.ok(
    !mapboxSource.includes("async function fetchMapboxRoadRouteCoordinates"),
    "use-mapbox must not keep a local copy of the directions fetcher",
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — `ENOENT … lib/explore/road-route.ts`.

**Step 3: Create the module**

Перед переносом убедиться, что переносимые символы не используются где-то ещё:

Run: `grep -n "MAPBOX_DIRECTIONS_MAX_WAYPOINTS\|MAPBOX_DIRECTIONS_PROFILE\|isLngLatCoordinate" composables/use-mapbox.ts`

Expected: только объявления (строки 11-12, 122) и использования внутри `fetchMapboxRoadRouteCoordinates` (84, 97, 115) + вызов в `drawRoadRouteLine` (~640). Если есть другие места — STOP, разобраться.

Create `lib/explore/road-route.ts`:

```ts
// Road-following geometry for a sequence of route points, fetched from the
// Mapbox Directions API. Shared between the live explore map (which swaps
// its straight polyline for this geometry) and the offline download flow
// (which captures it once, while online, so the offline preview can render
// the real walking path).

export const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25;
export const MAPBOX_DIRECTIONS_PROFILE = "walking";

export type RoadRoutePoint = {
  lat: number;
  lng: number;
};

export async function fetchMapboxRoadRouteCoordinates(
  points: RoadRoutePoint[],
  accessToken: string,
): Promise<[number, number][]> {
  if (!accessToken || points.length < 2 || points.length > MAPBOX_DIRECTIONS_MAX_WAYPOINTS)
    return [];

  const waypointPath = points
    .map(point => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/${MAPBOX_DIRECTIONS_PROFILE}/${waypointPath}?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok)
      return [];

    const payload = await response.json() as {
      routes?: Array<{
        geometry?: {
          coordinates?: unknown;
        };
      }>;
    };
    const coordinates = payload.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates))
      return [];

    return coordinates.filter(isLngLatCoordinate);
  }
  catch {
    return [];
  }
}

function isLngLatCoordinate(input: unknown): input is [number, number] {
  return Array.isArray(input)
    && input.length >= 2
    && typeof input[0] === "number"
    && typeof input[1] === "number"
    && Number.isFinite(input[0])
    && Number.isFinite(input[1]);
}
```

**Step 4: Rewire use-mapbox.ts**

В `composables/use-mapbox.ts`:

1. Добавить импорт (рядом с импортами из `route-marker`):

```ts
import { fetchMapboxRoadRouteCoordinates } from "~/lib/explore/road-route";
```

2. Удалить константы `MAPBOX_DIRECTIONS_MAX_WAYPOINTS` и `MAPBOX_DIRECTIONS_PROFILE` (строки 11-12).
3. Удалить функции `fetchMapboxRoadRouteCoordinates` (строки 83-120) и `isLngLatCoordinate` (строки 122-129). Функцию `isValidRouteMapPoint` НЕ трогать — она используется в других местах.
4. В `drawRoadRouteLine` (~строка 640) обновить вызов:

```ts
    const roadCoordinates = await fetchMapboxRoadRouteCoordinates(routeCoordinates, mapboxAccessToken);
```

Поведение онлайн-карты не меняется: guard `points.length < 2` и пустой токен уже проверяются на call-site, новый внутренний guard дублирует их безопасно.

**Step 5: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (1 test).

**Step 6: Commit**

```bash
git add lib/explore/road-route.ts composables/use-mapbox.ts tests/server/offline-route-preview.test.mjs
git commit -m "refactor(explore): extract mapbox road-route fetcher into lib

The directions fetcher was module-private in use-mapbox and bound to its
module-level access token, so the offline download flow couldn't reuse it.
Move it to lib/explore/road-route.ts with the token as a parameter; the
live map behavior is unchanged."
```

---

### Task 2: Поля маршрута в записи региона (`region-store.ts`)

**Files:**
- Modify: `lib/offline/region-store.ts`
- Modify: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Append to `tests/server/offline-route-preview.test.mjs`:

```js
test("offline region record persists route points and geometry", async () => {
  const storeSource = await readFile("lib/offline/region-store.ts", "utf8");
  // New fields on the record + input.
  assert.match(storeSource, /routePoints\?: RouteMapPoint\[\];/);
  assert.match(storeSource, /routeGeometry\?: \[number, number\]\[\] \| null;/);
  // Vue reactive proxies throw DataCloneError in IndexedDB (same hazard
  // toPlainBbox already guards) — points must be cloned to plain objects.
  assert.match(storeSource, /function toPlainRoutePoints/);
  assert.match(storeSource, /toPlainRoutePoints\(input\.routePoints\)/);
  // routeGeometry must be patchable after the fact (it arrives async,
  // in parallel with the tile download).
  assert.match(storeSource, /"routeGeometry"/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — `routePoints?: RouteMapPoint[]` not found.

**Step 3: Implement**

В `lib/offline/region-store.ts`:

1. Импорт типа (вверху, рядом с импортом `Bbox`; прецедент `lib/offline → lib/explore` уже есть в `bbox-from-route.ts:1`):

```ts
import type { RouteMapPoint } from "~/lib/explore/route-map";
```

2. В тип `OfflineRegion` (после `totalTiles?: number;`):

```ts
  routePoints?: RouteMapPoint[];
  routeGeometry?: [number, number][] | null;
```

3. В тип `OfflineRegionInput` (после `totalTiles?: number;`):

```ts
  routePoints?: RouteMapPoint[];
```

4. Расширить `OfflineRegionPatch`:

```ts
export type OfflineRegionPatch = Partial<
  Pick<OfflineRegion, "status" | "actualBytes" | "tilesDone" | "totalTiles" | "lastUsed" | "routeGeometry">
>;
```

5. Рядом с `toPlainBbox` добавить:

```ts
// Same structured-clone hazard as `toPlainBbox`: route points arrive as Vue
// reactive proxies from component props, and IndexedDB's structured clone
// throws DataCloneError on them. RouteMapPoint is flat, so a shallow copy
// per point is enough.
function toPlainRoutePoints(points: RouteMapPoint[]): RouteMapPoint[] {
  return points.map(point => ({ ...point }));
}
```

6. В `addRegion`, в объект `region` (после `totalTiles: input.totalTiles,`):

```ts
    routePoints: input.routePoints ? toPlainRoutePoints(input.routePoints) : undefined,
    routeGeometry: null,
```

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add lib/offline/region-store.ts tests/server/offline-route-preview.test.mjs
git commit -m "feat(offline): persist route points and geometry in region records

Regions stored only pointCount — the actual route lived in session memory
and was gone offline. Add routePoints (cloned to plain objects, same
DataCloneError guard as bbox) and a patchable routeGeometry field. No DB
version bump: records are schemaless, old regions simply lack the fields."
```

---

### Task 3: Прокинуть точки маршрута из explore в запись региона

Сейчас `download-trigger.vue:83-87` эмитит только `pointCount: props.routePoints.length`. Прокидываем массив целиком через payload: trigger → `pages/explore.vue` → `download-sheet.vue` → `offlineRegions.add()`.

**Files:**
- Modify: `components/offline/download-trigger.vue:17-20, 83-88`
- Modify: `pages/explore.vue` (~строка 365, тип `OfflineDownloadPayload`)
- Modify: `components/offline/download-sheet.vue:16-29, 184-196`
- Modify: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("download flow forwards the actual route points into the region record", async () => {
  const triggerSource = await readFile("components/offline/download-trigger.vue", "utf8");
  assert.match(triggerSource, /routePoints: \[\.\.\.props\.routePoints\]/);

  const exploreSource = await readFile("pages/explore.vue", "utf8");
  assert.match(exploreSource, /routePoints: RouteMapPoint\[\];/);

  const sheetSource = await readFile("components/offline/download-sheet.vue", "utf8");
  assert.match(sheetSource, /routePoints: payload\.routePoints/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — trigger pattern not found.

**Step 3: Implement**

1. `components/offline/download-trigger.vue` — тип эмита (строки 17-20):

```ts
const emit = defineEmits<{
  request: [payload: { bbox: Bbox; estimatedBytes: number; pointCount: number; routePoints: RouteMapPoint[] }];
  openManager: [];
}>();
```

…и в `onClick` (строки 83-88):

```ts
  emit("request", {
    bbox: bbox.value,
    estimatedBytes: sizeEstimate.value.bytes,
    pointCount: props.routePoints.length,
    routePoints: [...props.routePoints],
  });
```

2. `pages/explore.vue` — тип `OfflineDownloadPayload` (~строка 365):

```ts
type OfflineDownloadPayload = {
  bbox: Bbox;
  estimatedBytes: number;
  pointCount: number;
  routePoints: RouteMapPoint[];
};
```

(`RouteMapPoint` в explore.vue уже импортирован — проверить `grep -n "RouteMapPoint" pages/explore.vue | head -3`; если только value-импорты из route-map — добавить в существующий import.)

3. `components/offline/download-sheet.vue` — тип props (строки 16-24):

```ts
import type { RouteMapPoint } from "~/lib/explore/route-map";
```

```ts
const props = defineProps<{
  payload: {
    bbox: Bbox;
    estimatedBytes: number;
    pointCount: number;
    routePoints: RouteMapPoint[];
  } | null;
  /** Optional human-readable label, e.g. the trip's selected city. */
  regionLabel?: string;
}>();
```

Тип эмита `confirm` (строка 28) — payload-тип тот же, добавить `routePoints: RouteMapPoint[]` в него же.

…и в `onConfirm` (строки 187-194):

```ts
    region = await offlineRegions.add({
      bbox: payload.bbox,
      estimatedBytes: payload.estimatedBytes,
      pointCount: payload.pointCount,
      regionLabel: props.regionLabel ?? null,
      status: "metadata",
      totalTiles: totalTilesPreview.value,
      routePoints: payload.routePoints,
    });
```

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (3 tests).

**Step 5: Typecheck the touched graph**

Run: `pnpm lint:source`

Expected: ноль ошибок (eslint поймает несостыковку типов emit/props в SFC).

**Step 6: Commit**

```bash
git add components/offline/download-trigger.vue components/offline/download-sheet.vue pages/explore.vue tests/server/offline-route-preview.test.mjs
git commit -m "feat(offline): thread route points from explore into region downloads

The trigger emitted only pointCount; the points array it already held was
discarded, so offline regions had no route to show. Pass the full
RouteMapPoint[] through the payload chain into addRegion."
```

---

### Task 4: Снять дорожную геометрию в момент скачивания

Запускаем запрос Directions параллельно со скачиванием тайлов; результат дописывается в запись региона через новый метод композабла. Ошибка/отмена не валит скачивание.

**Files:**
- Modify: `composables/use-offline-regions.ts` (импорты, новый метод, return)
- Modify: `components/offline/download-sheet.vue` (импорт + `onConfirm`)
- Modify: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("road geometry is captured once at download time", async () => {
  const composableSource = await readFile("composables/use-offline-regions.ts", "utf8");
  assert.match(composableSource, /async function setRouteGeometry/);
  assert.match(composableSource, /setRouteGeometry,/);

  const sheetSource = await readFile("components/offline/download-sheet.vue", "utf8");
  assert.match(sheetSource, /fetchMapboxRoadRouteCoordinates/);
  assert.match(sheetSource, /setRouteGeometry/);
  // Geometry capture must not block or fail the tile download.
  assert.match(sheetSource, /\.catch\(/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — `setRouteGeometry` not found.

**Step 3: Implement composable method**

В `composables/use-offline-regions.ts`:

1. Дополнить импорт из region-store:

```ts
import {
  addRegion as storeAdd,
  listRegions as storeList,
  removeRegion as storeRemove,
  touchRegion as storeTouch,
  updateRegion as storeUpdate,
} from "~/lib/offline/region-store";
```

2. Внутри `useOfflineRegions()` (после `refresh`):

```ts
  async function setRouteGeometry(id: string, geometry: [number, number][] | null): Promise<void> {
    await storeUpdate(id, { routeGeometry: geometry });
    patchLocal(id, { routeGeometry: geometry });
  }
```

3. Добавить `setRouteGeometry,` в возвращаемый объект (после `refresh,`).

**Step 4: Fire the capture from the sheet**

В `components/offline/download-sheet.vue`:

1. Импорт:

```ts
import { fetchMapboxRoadRouteCoordinates } from "~/lib/explore/road-route";
```

2. В `onConfirm`, сразу после `saveState.value = "downloading";` (перед `await offlineRegions.download(...)`):

```ts
  // Capture the road-following line once, while we're still online — it's
  // what the offline preview draws instead of straight segments. Runs
  // concurrently with the tile download; any failure (no token, >25 points,
  // network) just leaves routeGeometry null and the preview falls back.
  const mapboxToken = typeof config.public.mapboxToken === "string" ? config.public.mapboxToken : "";
  void fetchMapboxRoadRouteCoordinates(payload.routePoints, mapboxToken)
    .then(coordinates => offlineRegions.setRouteGeometry(region.id, coordinates.length >= 2 ? coordinates : null))
    .catch(() => {});
```

(`config` уже объявлен в компоненте — `useRuntimeConfig()` на строке 35. Если пользователь отменил скачивание и регион удалён, `storeUpdate` вернёт null — это no-op, безопасно.)

**Step 5: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (4 tests).

**Step 6: Commit**

```bash
git add composables/use-offline-regions.ts components/offline/download-sheet.vue tests/server/offline-route-preview.test.mjs
git commit -m "feat(offline): capture road route geometry at download time

Fetch Mapbox Directions once while online, concurrently with the tile
download, and patch the coordinates into the region record. Failure or
cancellation leaves routeGeometry null — the preview falls back to
straight segments."
```

---

### Task 5: Линия и маркеры маршрута в превью

**Files:**
- Modify: `components/offline/region-preview.vue` (script: импорты, состояние, `initMap`, `teardownMap`)
- Modify: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("offline preview renders the stored route as line + markers", async () => {
  const previewSource = await readFile("components/offline/region-preview.vue", "utf8");
  // HTML markers + popups (no glyph dependency — offline style has none).
  assert.match(previewSource, /createMarkerElement/);
  assert.match(previewSource, /createPopupHTML/);
  // GeoJSON line with straight-segment fallback when capture failed.
  assert.match(previewSource, /LineString/);
  assert.match(previewSource, /routeGeometry/);
  assert.match(previewSource, /points\.map\(point => \[point\.lng, point\.lat\]\)/);
  // Markers are torn down with the map.
  assert.match(previewSource, /marker\.remove\(\)/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — `createMarkerElement` not found.

**Step 3: Implement**

В `components/offline/region-preview.vue` (script):

1. Импорт после существующих:

```ts
import { createMarkerElement, createPopupHTML } from "~/components/explore/route-marker";
```

2. Константы и состояние (рядом с `let mapInstance`):

```ts
const ROUTE_LINE_SOURCE_ID = "offline-route-line";
const ROUTE_LINE_LAYER_ID = "offline-route-line";

let routeMarkers: Array<{ remove: () => void }> = [];
```

…и расширить тип `mapInstance` (понадобится для `flyTo` в Task 6):

```ts
let mapInstance: {
  remove: () => void;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
} | null = null;
```

3. В `initMap`, внутри `try`, после `map.addControl(...)` добавить замыкание и повесить его на `load` (заменить текущий `map.on("load", ...)`):

```ts
    // Route overlay: GeoJSON line (road geometry captured at download time,
    // straight segments as fallback) + numbered HTML markers with popups.
    // HTML markers don't need glyphs, which the offline style deliberately
    // lacks; popups reuse the explore look (day badge + name).
    const renderRouteOverlay = () => {
      const points = region.routePoints ?? [];
      if (!points.length)
        return;

      const lineCoordinates = region.routeGeometry && region.routeGeometry.length >= 2
        ? region.routeGeometry
        : points.map(point => [point.lng, point.lat]);

      if (lineCoordinates.length >= 2) {
        map.addSource(ROUTE_LINE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: lineCoordinates },
          },
        } as never);
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: "line",
          source: ROUTE_LINE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2dd4bf", "line-opacity": 0.9, "line-width": 4 },
        } as never);
      }

      points.forEach((point, index) => {
        const { element } = createMarkerElement(point, index, index * 40);
        const popup = new ml.Popup({ offset: 18, closeButton: false }).setHTML(createPopupHTML(point));
        const marker = new ml.Marker({ element })
          .setLngLat([point.lng, point.lat])
          .setPopup(popup)
          .addTo(map);
        routeMarkers.push(marker);
      });
    };

    map.on("load", () => {
      mapLoaded.value = true;
      renderRouteOverlay();
    });
```

(`as never` — тот же приём, что у `style: buildOfflineStyle(...) as never` строкой выше: maplibre-типы в этом файле сознательно не затягиваются, компонент держит карту за минимальный структурный тип.)

4. В `teardownMap` (перед `mapInstance.remove()`):

```ts
  for (const marker of routeMarkers)
    marker.remove();
  routeMarkers = [];
```

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add components/offline/region-preview.vue tests/server/offline-route-preview.test.mjs
git commit -m "feat(offline): render saved route line and markers in region preview

Draw the captured road geometry (straight segments as fallback) as a
GeoJSON line and the stored points as numbered HTML markers with popups —
the same elements the explore map uses, none of which need glyphs, which
the offline style deliberately lacks."
```

---

### Task 6: Список точек по дням + flyTo + подсказка для старых регионов

**Files:**
- Modify: `components/offline/region-preview.vue` (script + template)
- Modify: `tests/server/offline-route-preview.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("offline preview lists route points grouped by day", async () => {
  const previewSource = await readFile("components/offline/region-preview.vue", "utf8");
  assert.match(previewSource, /getRouteDayGroups/);
  assert.match(previewSource, /formatRouteDistance/);
  // Tapping a list row recenters the map on that point.
  assert.match(previewSource, /flyTo/);
  // Regions downloaded before this feature degrade gracefully with a hint.
  assert.match(previewSource, /Маршрут не сохранён/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: FAIL — `getRouteDayGroups` not found.

**Step 3: Implement script part**

В `components/offline/region-preview.vue` (script):

1. Импорты:

```ts
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { formatRouteDistance, getRouteDayGroups } from "~/lib/explore/route-map";
```

2. Computed-блоки (после `tilesAvailable`):

```ts
const hasRoute = computed(() => Boolean(props.region?.routePoints?.length));

const dayGroups = computed(() =>
  props.region?.routePoints?.length ? getRouteDayGroups(props.region.routePoints) : [],
);

// List numbering must match the marker numbering (global order across days).
const pointNumbers = computed(() => {
  const numbers = new Map<string, number>();
  (props.region?.routePoints ?? []).forEach((point, index) => numbers.set(point.id, index + 1));
  return numbers;
});

function pointMetaLabel(point: RouteMapPoint): string {
  const parts: string[] = [];
  if (point.estimatedDurationMinutes)
    parts.push(`${point.estimatedDurationMinutes} мин`);
  const distance = formatRouteDistance(point.approximateDistanceMeters ?? null);
  if (distance)
    parts.push(distance);
  return parts.join(" · ");
}

function onPointClick(point: RouteMapPoint) {
  mapInstance?.flyTo({ center: [point.lng, point.lat], zoom: 15 });
}
```

**Step 4: Implement template part**

Обернуть существующий блок `<!-- Map canvas -->` во flex-контейнер и добавить список. Структура (map-блок внутри остаётся как есть — контейнер, скрим, error):

```html
          <!-- Body: map + route point list -->
          <div class="flex min-h-0 flex-1 max-md:flex-col">
            <!-- Map canvas -->
            <div class="relative min-h-0 flex-1 bg-[var(--explore-surface-hover)]">
              <!-- …существующее содержимое без изменений… -->
            </div>

            <!-- Route point list -->
            <aside
              v-if="hasRoute"
              class="shrink-0 overflow-y-auto border-[var(--explore-border)] max-md:max-h-[38%] max-md:border-t md:w-[280px] md:border-l"
              aria-label="Точки маршрута"
            >
              <div
                v-for="group in dayGroups"
                :key="group.day"
                class="px-4 py-3"
              >
                <p class="explore-section-label mb-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                  День {{ group.day }}
                </p>
                <ul class="space-y-1">
                  <li v-for="point in group.points" :key="point.id">
                    <button
                      type="button"
                      class="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--explore-surface-hover)]"
                      :aria-label="`Показать на карте: ${point.name}`"
                      @click="onPointClick(point)"
                    >
                      <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--explore-marker-generated)] text-[10px] font-bold text-[var(--explore-primary-text)]">
                        {{ pointNumbers.get(point.id) }}
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-xs font-bold text-[var(--explore-text)]">{{ point.name }}</span>
                        <span
                          v-if="pointMetaLabel(point)"
                          class="block font-mono text-[10px] text-[var(--explore-text-soft)]"
                        >
                          {{ pointMetaLabel(point) }}
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
```

В footer добавить подсказку деградации (между двумя существующими `<span>`):

```html
            <span
              v-if="!hasRoute"
              class="text-[var(--explore-text-faint)]"
            >
              Маршрут не сохранён — скачайте регион заново
            </span>
```

**Step 5: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-route-preview.test.mjs`

Expected: PASS (6 tests).

**Step 6: Commit**

```bash
git add components/offline/region-preview.vue tests/server/offline-route-preview.test.mjs
git commit -m "feat(offline): add day-grouped route point list to region preview

Side column on desktop, stacked under the map on mobile: numbered rows
matching the markers, duration/distance meta, flyTo on tap. Regions
downloaded before route persistence show a re-download hint instead."
```

---

### Task 7: Полная верификация

**Files:** нет изменений кода (фиксы — только если верификация падает).

**Step 1: Full server test suite**

Run: `node scripts/run-node-tests.mjs tests/server`

Expected: все тесты зелёные (280 старых + 6 новых).

**Step 2: Lint (blocker per project rules)**

Run: `pnpm lint:fix`, затем `pnpm lint:source`

Expected: ноль ошибок.

**Step 3: Live verification — preview tools, порт 3001**

`preview_start` с конфигом `nuxt-dev` (порт 3001 — пользовательский сервер, переиспользуется если уже запущен).

Открыть `/offline`, затем через `preview_eval` скачать регион с маршрутом через реальный пайплайн (геометрию не пишем — проверяем фоллбек на прямые отрезки; путь с геометрией покрыт source-тестами Task 4):

```js
(async () => {
  const store = await import('/_nuxt/lib/offline/region-store.ts');
  const dl = await import('/_nuxt/lib/offline/region-downloader.ts');
  const bbox = [37.60, 55.74, 37.64, 55.76];
  const routePoints = [
    { id: "p1", sourceId: "p1", markerKind: "generated", sequence: 0, day: 1, name: "Красная площадь", lat: 55.7539, lng: 37.6208 },
    { id: "p2", sourceId: "p2", markerKind: "generated", sequence: 1, day: 1, name: "ГУМ", lat: 55.7547, lng: 37.6215, estimatedDurationMinutes: 40, approximateDistanceMeters: 350 },
    { id: "p3", sourceId: "p3", markerKind: "generated", sequence: 2, day: 2, name: "Парк Зарядье", lat: 55.7510, lng: 37.6290, estimatedDurationMinutes: 60, approximateDistanceMeters: 900 },
  ];
  const region = await store.addRegion({ bbox, estimatedBytes: 0, pointCount: routePoints.length, regionLabel: 'route-fix', status: 'metadata', routePoints });
  const result = await dl.downloadRegion({ regionId: region.id, bbox });
  return { regionId: region.id, result };
})()
```

Expected: `{ tilesDone: 26, totalTiles: 26, cancelled: false }`.

**Step 4: Открыть превью и проверить рендер**

Перезагрузить страницу, кликнуть `button[aria-label="Открыть route-fix"]`, подождать ~2.5с, затем `preview_eval`:

```js
(() => {
  const mapDiv = document.querySelector('.maplibregl-map');
  const r = mapDiv ? mapDiv.getBoundingClientRect() : null;
  return {
    mapHeight: r ? Math.round(r.height) : 0,
    markers: document.querySelectorAll('.maplibregl-marker').length,
    listRows: document.querySelectorAll('aside [aria-label^="Показать на карте"]').length,
    dayHeaders: [...document.querySelectorAll('aside p')].map(p => p.textContent.trim()).filter(t => t.startsWith('День')),
    scrimGone: !document.querySelector('.explore-loading-scrim'),
  };
})()
```

Expected: `mapHeight > 300`, `markers: 3`, `listRows: 3`, `dayHeaders: ["День 1", "День 2"]`, `scrimGone: true`.

Затем `preview_click` по `.maplibregl-marker` → `preview_eval`: `Boolean(document.querySelector('.maplibregl-popup'))` → `true`.

`preview_screenshot` — на скриншоте: бирюзовая линия маршрута, 3 нумерованных маркера, список точек по дням.

**Step 5: Деградация старого региона**

Кликнуть регион `verify-fix` (скачан до фичи, без routePoints; если его нет в IndexedDB — создать через `addRegion` без `routePoints` + `downloadRegion`). Проверить: маркеров 0, списка нет (`aside` отсутствует), в футере текст «Маршрут не сохранён — скачайте регион заново», тайлы рендерятся.

**Step 6: Report**

Зафиксировать результаты (метрики + скриншот) в ответе пользователю. Если что-то не сошлось — STOP, вернуться к диагностике, код не «подгонять» под стенд.

**Known caveat:** headless-превью может приостанавливать rAF у скрытого окна (см. прошлый план) — решающий критерий: счётчики маркеров/строк и высота карты; скрим/скриншот — best effort. Путь с реальной дорожной геометрией end-to-end (explore → «Скачать офлайн» → превью) проверяется пользователем вручную, ему нужен живой AI-маршрут на `/explore`.

---

## Done criteria

- `node scripts/run-node-tests.mjs tests/server` — зелёный (286 тестов).
- `pnpm lint:source` — ноль новых ошибок.
- В превью скачанного с маршрутом региона: линия + нумерованные маркеры + попапы + список точек по дням, flyTo по клику; деградация старых регионов с подсказкой.
- 6 атомарных коммитов (Task 1-6) + закоммиченные дизайн-док и план; untracked-мусор не тронут.
