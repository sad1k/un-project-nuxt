# Offline Tile Detail Option — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Дать пользователю выбор детализации тайлов при скачивании офлайн-региона: «Экономия» (z12), «Стандарт» (z14, дефолт), «Максимум» (z15) — с живым пересчётом размера и корректным `maxzoom` в превью.

**Architecture:** Пресет выбирается радио-карточками в download-sheet и прокидывается через весь пайплайн: `estimateRegionSize(bbox, maxZoom)` → `OfflineRegion.maxZoom` (бессхемное поле, без бампа версии — прецедент `routePoints`) → `download(regionId, bbox, maxZoom)` → уже существующий параметр `downloadRegion` → `buildOfflineStyle(..., maxZoom)` в превью. PMTiles-архив Protomaps содержит z15 (проверено `getHeader()`); `maxzoom` источника в стиле обязан совпадать со скачанным диапазоном, иначе «Экономия» даёт пустую карту глубже z12 вместо векторного растягивания.

**Tech Stack:** Nuxt 3, Vue 3, MapLibre GL, PMTiles, IndexedDB, node:test (раннер `scripts/run-node-tests.mjs`).

**Reference:** [docs/plans/2026-06-12-offline-tile-detail-design.md](2026-06-12-offline-tile-detail-design.md)

**Тесты:** source-level (читают исходники, проверяют паттерны — стиль `tests/server/offline-route-preview.test.mjs`), один растущий файл `tests/server/offline-tile-detail.test.mjs`.

---

## Pre-flight

Run: `git status && git log --oneline -2`

Expected: ветка `main` (рабочий паттерн репо), последний коммит — `docs(offline): design for tile detail option…`. Untracked `.agents/`, `composables/use-user-route-points.ts.bak`, `skills-lock.json` не трогать и не коммитить.

---

### Task 1: Параметр maxZoom в эстиматоре размера

**Files:**
- Modify: `lib/offline/size-estimator.ts:14-23`
- Create: `tests/server/offline-tile-detail.test.mjs`

**Step 1: Write the failing test**

Create `tests/server/offline-tile-detail.test.mjs`:

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("size estimator is parameterized by max zoom", async () => {
  // The download sheet recomputes the size per detail preset, so the
  // estimator can't hardcode the z0-14 range anymore.
  const source = await readFile("lib/offline/size-estimator.ts", "utf8");
  assert.match(source, /export function estimateRegionSize\(bbox: Bbox, maxZoom = MAX_ZOOM\)/);
  assert.match(source, /z <= maxZoom/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: FAIL — signature pattern not found.

**Step 3: Implement**

В `lib/offline/size-estimator.ts` заменить сигнатуру и цикл (строки 14-17):

```ts
export function estimateRegionSize(bbox: Bbox, maxZoom = MAX_ZOOM): { bytes: number; tiles: number } {
  let tiles = 0;
  for (let z = MIN_ZOOM; z <= maxZoom; z += 1)
    tiles += tilesAtZoom(bbox, z);
```

Остальное (return, хелперы) не трогать. Поведение всех текущих вызовов не меняется — дефолт тот же.

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: PASS (1 test).

**Step 5: Commit**

```bash
git add lib/offline/size-estimator.ts tests/server/offline-tile-detail.test.mjs
git commit -m "refactor(offline): parameterize size estimate by max zoom

The download sheet is about to recompute the size per detail preset;
the hardcoded z0-14 range moves to a default parameter. No behavior
change for existing callers."
```

---

### Task 2: Поле maxZoom в записи региона

**Files:**
- Modify: `lib/offline/region-store.ts` (типы `OfflineRegion`, `OfflineRegionInput`, объект в `addRegion`)
- Modify: `tests/server/offline-tile-detail.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("offline region record persists the chosen detail level", async () => {
  const storeSource = await readFile("lib/offline/region-store.ts", "utf8");
  // Field on both the record and the input (schemaless — no DB version bump).
  const maxZoomFields = storeSource.match(/maxZoom\?: number;/g) ?? [];
  assert.equal(maxZoomFields.length, 2, "maxZoom on both OfflineRegion and OfflineRegionInput");
  assert.match(storeSource, /maxZoom: input\.maxZoom,/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: FAIL — 0 ≠ 2.

**Step 3: Implement**

В `lib/offline/region-store.ts`:

1. В тип `OfflineRegion` (после `totalTiles?: number;`, перед `routePoints`):

```ts
  maxZoom?: number;
```

2. В тип `OfflineRegionInput` (после `totalTiles?: number;`):

```ts
  maxZoom?: number;
```

3. В `addRegion`, в объект `region` (после `totalTiles: input.totalTiles,`):

```ts
    maxZoom: input.maxZoom,
```

Старые записи без поля читаются как `undefined` → потребители используют `?? 14`.

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add lib/offline/region-store.ts tests/server/offline-tile-detail.test.mjs
git commit -m "feat(offline): persist chosen detail level in region records

maxZoom is needed later by the preview style: the source maxzoom must
match what was actually downloaded, or MapLibre blanks instead of
overzooming. Schemaless field, no DB version bump; old records read as
undefined and default to 14."
```

---

### Task 3: Прокинуть maxZoom через композабл

**Files:**
- Modify: `composables/use-offline-regions.ts` (сигнатура `download`, вызов `runDownload`)
- Modify: `tests/server/offline-tile-detail.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("regions composable forwards maxZoom to the downloader", async () => {
  // downloadRegion already accepts minZoom/maxZoom — the composable just
  // never passed them.
  const composableSource = await readFile("composables/use-offline-regions.ts", "utf8");
  assert.match(composableSource, /async function download\(regionId: string, bbox: Bbox, maxZoom\?: number\)/);
  assert.match(composableSource, /regionId,\s*\n\s*bbox,\s*\n\s*maxZoom,/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: FAIL — signature pattern not found.

**Step 3: Implement**

В `composables/use-offline-regions.ts`:

1. Сигнатура:

```ts
  async function download(regionId: string, bbox: Bbox, maxZoom?: number): Promise<DownloadResult> {
```

2. В вызове `runDownload` добавить `maxZoom` после `bbox`:

```ts
      const result = await runDownload({
        regionId,
        bbox,
        maxZoom,
        signal: controller.signal,
        onProgress,
      });
```

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add composables/use-offline-regions.ts tests/server/offline-tile-detail.test.mjs
git commit -m "feat(offline): forward max zoom from composable to downloader

downloadRegion supported the zoom range since day one; the composable
just never passed it. Optional parameter, default behavior unchanged."
```

---

### Task 4: Пресеты детализации в download-sheet

Радио-карточки + пересчёт размера/квоты/тайлов от выбранного пресета + прокидка в `add` и `download`.

**Files:**
- Modify: `components/offline/download-sheet.vue` (script: импорт, константы, computed'ы; template: блок карточек, строка «добавится»)
- Modify: `tests/server/offline-tile-detail.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("download sheet offers detail presets and threads the choice", async () => {
  const sheetSource = await readFile("components/offline/download-sheet.vue", "utf8");
  for (const label of ["Экономия", "Стандарт", "Максимум"])
    assert.ok(sheetSource.includes(label), `${label} preset present`);
  assert.match(sheetSource, /maxZoom: 12/);
  assert.match(sheetSource, /maxZoom: 14/);
  assert.match(sheetSource, /maxZoom: 15/);
  // Size, quota and tile counts follow the selected preset…
  assert.match(sheetSource, /estimateRegionSize\(props\.payload\.bbox, selectedMaxZoom\.value\)/);
  assert.match(sheetSource, /countTiles\(props\.payload\.bbox, 0, selectedMaxZoom\.value\)/);
  // …and the choice reaches both the record and the downloader.
  assert.match(sheetSource, /maxZoom: selectedMaxZoom\.value/);
  assert.match(sheetSource, /download\(region\.id, payload\.bbox, selectedMaxZoom\.value\)/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: FAIL — «Экономия» not found.

**Step 3: Implement script part**

В `components/offline/download-sheet.vue` (script):

1. Расширить импорт эстиматора:

```ts
import { estimateRegionSize, formatSizeMB } from "~/lib/offline/size-estimator";
```

2. После `const SAVED_CLOSE_DELAY_MS = 700;` добавить:

```ts
// Detail presets: maxZoom is the deepest tile level fetched. The PMTiles
// archive tops out at z15 (real extra geometry); past the chosen level
// MapLibre overzooms vector tiles, which stays sharp but loses features
// that only exist in deeper tiles (e.g. buildings are absent in z12).
const DETAIL_PRESETS = [
  { key: "compact", maxZoom: 12, label: "Экономия", description: "Контуры города, без зданий" },
  { key: "standard", maxZoom: 14, label: "Стандарт", description: "Улицы и здания" },
  { key: "max", maxZoom: 15, label: "Максимум", description: "Вся геометрия: здания, дорожки" },
] as const;
type DetailLevelKey = (typeof DETAIL_PRESETS)[number]["key"];
```

3. После `const isOpen = computed(...)` добавить состояние и пересчёты:

```ts
const detailLevel = ref<DetailLevelKey>("standard");
const selectedMaxZoom = computed(() =>
  DETAIL_PRESETS.find(preset => preset.key === detailLevel.value)?.maxZoom ?? 14,
);
const selectedEstimateBytes = computed(() =>
  props.payload ? estimateRegionSize(props.payload.bbox, selectedMaxZoom.value).bytes : 0,
);

function presetSizeLabel(maxZoom: number): string {
  if (!props.payload)
    return "";
  return formatSizeMB(estimateRegionSize(props.payload.bbox, maxZoom).bytes);
}
```

4. Переключить производные с `payload.estimatedBytes` (оценка триггера — всегда «Стандарт») на выбранный пресет:

```ts
const sizeLabel = computed(() => (props.payload ? formatSizeMB(selectedEstimateBytes.value) : ""));
```

```ts
const projectedTotalBytes = computed(() => {
  if (!props.payload)
    return currentUsedBytes.value;
  return currentUsedBytes.value + selectedEstimateBytes.value;
});
```

В `quotaWarning` заменить условие `large-single`:

```ts
  if (selectedEstimateBytes.value > LARGE_SINGLE_REGION_BYTES)
    return "large-single";
```

```ts
const totalTilesPreview = computed(() => {
  if (!props.payload)
    return 0;
  return countTiles(props.payload.bbox, 0, selectedMaxZoom.value);
});
```

5. В `onConfirm` — записать выбор в регион и передать загрузчику:

```ts
    region = await offlineRegions.add({
      bbox: payload.bbox,
      estimatedBytes: selectedEstimateBytes.value,
      pointCount: payload.pointCount,
      regionLabel: props.regionLabel ?? null,
      status: "metadata",
      totalTiles: totalTilesPreview.value,
      routePoints: payload.routePoints,
      maxZoom: selectedMaxZoom.value,
    });
```

```ts
    const result = await offlineRegions.download(region.id, payload.bbox, selectedMaxZoom.value);
```

6. В `watch(() => props.payload, ...)` сбрасывать пресет при новом открытии (внутри `if (next) {`):

```ts
    detailLevel.value = "standard";
```

**Step 4: Implement template part**

Вставить блок карточек между баннером quota warning (`<!-- Quota warning / error banner -->`…`</div>`) и блоком `<!-- Size + quota -->`:

```html
            <!-- Detail level -->
            <fieldset :disabled="saveState !== 'idle' && saveState !== 'error'">
              <legend class="explore-section-label mb-2 text-[11px] font-bold uppercase tracking-[0.2em]">
                Детализация карты
              </legend>
              <div class="grid grid-cols-3 gap-2 max-md:grid-cols-1">
                <label
                  v-for="preset in DETAIL_PRESETS"
                  :key="preset.key"
                  class="cursor-pointer rounded-xl border px-3 py-2.5 transition-colors"
                  :class="detailLevel === preset.key
                    ? 'border-[var(--explore-accent-strong)] bg-[var(--explore-surface-soft)]'
                    : 'border-[var(--explore-border)] hover:bg-[var(--explore-surface-hover)]'"
                >
                  <input
                    v-model="detailLevel"
                    type="radio"
                    name="offline-detail-level"
                    :value="preset.key"
                    class="sr-only"
                  >
                  <span class="block text-xs font-bold text-[var(--explore-text)]">{{ preset.label }}</span>
                  <span class="mt-0.5 block text-[10px] leading-4 text-[var(--explore-text-soft)]">{{ preset.description }}</span>
                  <span class="mt-1 block font-mono text-[10px] text-[var(--explore-text-muted)]">≈ {{ presetSizeLabel(preset.maxZoom) }}</span>
                </label>
              </div>
            </fieldset>
```

И в строке «Уже занято … добавится …» заменить источник:

```html
                Уже занято {{ formatSizeMB(currentUsedBytes) }} · добавится {{ formatSizeMB(selectedEstimateBytes) }} · итого {{ formatSizeMB(projectedTotalBytes) }}
```

**Step 5: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: PASS (4 tests).

**Step 6: Lint the touched SFC graph**

Run: `pnpm lint:source`

Expected: ноль ошибок (eslint валидирует типы emit/props и порядок импортов).

**Step 7: Commit**

```bash
git add components/offline/download-sheet.vue tests/server/offline-tile-detail.test.mjs
git commit -m "feat(offline): add detail presets to download sheet

Three radio cards (z12 / z14 / z15) with live per-preset size estimates.
Size, quota maths, and the tile count all follow the selection; the
choice lands in the region record and drives the tile range the
downloader fetches. Preset resets to standard each time the sheet opens
and locks once the download starts."
```

---

### Task 5: maxzoom источника в стиле превью

**Files:**
- Modify: `lib/offline/offline-style.ts:44-54`
- Modify: `components/offline/region-preview.vue` (вызов `buildOfflineStyle`)
- Modify: `tests/server/offline-tile-detail.test.mjs`

**Step 1: Write the failing test**

Append:

```js
test("offline preview style declares the downloaded zoom range", async () => {
  // Source maxzoom must match what was downloaded: declare 14 while only
  // z0-12 exists and MapLibre shows blank past z12 instead of overzooming.
  const styleSource = await readFile("lib/offline/offline-style.ts", "utf8");
  assert.match(styleSource, /maxZoom = 14/);
  assert.match(styleSource, /maxzoom: maxZoom/);

  const previewSource = await readFile("components/offline/region-preview.vue", "utf8");
  assert.match(previewSource, /buildOfflineStyle\(region\.id, theme, region\.maxZoom \?\? 14\)/);
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: FAIL — `maxZoom = 14` not found.

**Step 3: Implement**

1. `lib/offline/offline-style.ts` — сигнатура и источник:

```ts
export function buildOfflineStyle(regionId: string, theme: StyleTheme = "dark", maxZoom = 14): Record<string, unknown> {
```

```ts
      offline: {
        type: "vector",
        tiles: [buildOfflineTileUrl(regionId)],
        minzoom: 0,
        maxzoom: maxZoom,
      },
```

2. `components/offline/region-preview.vue`, в `initMap`:

```ts
      style: buildOfflineStyle(region.id, theme, region.maxZoom ?? 14) as never,
```

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-tile-detail.test.mjs`

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add lib/offline/offline-style.ts components/offline/region-preview.vue tests/server/offline-tile-detail.test.mjs
git commit -m "feat(offline): align preview style maxzoom with downloaded range

The source maxzoom now comes from the region record. A compact (z12)
region overzooms its deepest tiles instead of blanking past z12, and a
max (z15) region actually renders its extra detail. Old records lack
the field and keep the previous z14 behavior."
```

---

### Task 6: Полная верификация

**Files:** нет изменений кода (фиксы — только если верификация падает).

**Step 1: Full server test suite**

Run: `node scripts/run-node-tests.mjs tests/server`

Expected: все зелёные (286 старых + 5 новых = 291).

**Step 2: Lint (blocker per project rules)**

Run: `pnpm lint:fix`, затем `pnpm lint:source`

Expected: ноль ошибок, рабочее дерево без изменений после lint:fix.

**Step 3: Live — счётчики тайлов по пресетам**

`preview_start` с конфигом `nuxt-dev` (порт 3001, переиспользуется). Открыть `/offline`, затем `preview_eval`:

```js
(async () => {
  const { countTiles } = await import('/_nuxt/lib/offline/tile-enumerator.ts');
  const bbox = [37.61, 55.749, 37.625, 55.758];
  return { compact: countTiles(bbox, 0, 12), standard: countTiles(bbox, 0, 14), max: countTiles(bbox, 0, 15) };
})()
```

Expected: `compact < standard < max`, причём `max - standard` ≈ 3-4× тайлов уровня 14 (прирост z15).

**Step 4: Live — скачивание «Экономии» через реальный пайплайн**

```js
(async () => {
  const store = await import('/_nuxt/lib/offline/region-store.ts');
  const dl = await import('/_nuxt/lib/offline/region-downloader.ts');
  const bbox = [37.61, 55.749, 37.625, 55.758];
  const region = await store.addRegion({ bbox, estimatedBytes: 0, pointCount: 0, regionLabel: 'detail-fix', status: 'metadata', maxZoom: 12 });
  const result = await dl.downloadRegion({ regionId: region.id, bbox, maxZoom: 12 });
  const saved = await store.getRegion(region.id);
  return { result, savedMaxZoom: saved.maxZoom };
})()
```

Expected: `result.totalTiles` равен `compact` из шага 3, `cancelled: false`, `savedMaxZoom: 12`.

**Step 5: Live — превью «Экономии» рендерится (не бланкует)**

Перезагрузить страницу, кликнуть `button[aria-label="Открыть detail-fix"]`, подождать ~2.5с, `preview_eval`:

```js
(() => ({
  canvas: Boolean(document.querySelector('.maplibregl-canvas')),
  scrimGone: !document.querySelector('.explore-loading-scrim'),
  mapHeight: Math.round(document.querySelector('.maplibregl-map')?.getBoundingClientRect().height ?? 0),
}))()
```

Expected: `canvas: true`, `scrimGone: true`, `mapHeight > 0`. Решающий критерий — счётчики из шагов 3-4; скриншот — best effort (см. caveat прошлого плана про rAF в скрытом окне).

**Step 6: Report**

Зафиксировать метрики в ответе пользователю. Проверка «Максимума» end-to-end через UI (`/explore` → «Скачать офлайн» → карточка «Максимум») остаётся за пользователем — нужен живой маршрут и ~4× трафика.

---

## Done criteria

- `node scripts/run-node-tests.mjs tests/server` — зелёный (291 тест).
- `pnpm lint:source` — ноль ошибок.
- В sheet «Скачать регион» — три карточки с живыми размерами; выбор влияет на размер/квоту/число тайлов; регион хранит `maxZoom`; превью «Экономии» растягивает тайлы вместо пустоты.
- 5 атомарных коммитов (Task 1-5) + закоммиченные дизайн-док и план; untracked-мусор не тронут.
