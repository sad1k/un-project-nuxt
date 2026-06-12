# Offline Region Preview Blank Map Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Починить офлайн-превью региона: скачанные тайлы не отображаются, потому что контейнер карты схлопывается до высоты 0.

**Architecture:** `maplibre-gl.css` объявляет `.maplibregl-map { position: relative }` и загружается после Tailwind, перебивая класс `absolute` на контейнере — `inset-0` перестаёт задавать габариты, высота становится 0. Фикс: задать контейнеру явный размер `h-full w-full` (паттерн рабочей Mapbox-карты в `components/explore/map-view.client.vue`). Регрессия защищается source-level тестом в стиле существующих `tests/server/pwa-*.test.mjs`.

**Tech Stack:** Nuxt 3, Vue 3, MapLibre GL 4.7.1, Tailwind v4, node:test (раннер `scripts/run-node-tests.mjs`).

**Reference:** [docs/plans/2026-06-12-offline-region-preview-blank-map-design.md](2026-06-12-offline-region-preview-blank-map-design.md)

---

## Pre-flight

Run: `git status && git log --oneline -2`

Expected: ветка `main`, последний коммит — дизайн-док `docs(offline): diagnose blank region preview…`. Рабочее дерево может содержать untracked `.agents/`, `composables/use-user-route-points.ts.bak`, `skills-lock.json`, изменённый `.claude/launch.json` — их не трогать и не коммитить.

---

### Task 1: Регрессионный тест + однострочный фикс контейнера

**Files:**
- Create: `tests/server/offline-region-preview.test.mjs`
- Modify: `components/offline/region-preview.vue:175-179`

**Step 1: Write the failing test**

Create `tests/server/offline-region-preview.test.mjs`:

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const previewSource = await readFile("components/offline/region-preview.vue", "utf8");

test("offline preview map container sizes itself explicitly", () => {
  // maplibre-gl.css declares `.maplibregl-map { position: relative }` and is
  // dynamically imported AFTER Tailwind, so it silently overrides the
  // container's `absolute` class. With position:relative, `inset-0` stops
  // sizing the element and its height collapses to 0 — the preview renders
  // a blank gray rectangle. The container must use explicit h-full/w-full
  // (same pattern as the explore Mapbox map), never absolute+inset.
  const containerMatch = previewSource.match(/ref="mapContainer"\s+class="([^"]+)"/);
  assert.ok(containerMatch, "map container with ref=\"mapContainer\" not found");

  const classes = containerMatch[1].split(/\s+/);
  assert.ok(classes.includes("h-full"), "map container must have h-full");
  assert.ok(classes.includes("w-full"), "map container must have w-full");
  assert.ok(
    !classes.includes("absolute"),
    "absolute is overridden by .maplibregl-map { position: relative } from maplibre-gl.css — size explicitly instead",
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/offline-region-preview.test.mjs`

Expected: FAIL — `map container must have h-full` (текущий класс — `absolute inset-0`).

**Step 3: Write minimal implementation**

In `components/offline/region-preview.vue` replace (lines ~175-179):

```html
            <div
              ref="mapContainer"
              class="absolute inset-0"
            />
```

with:

```html
            <div
              ref="mapContainer"
              class="h-full w-full"
            />
```

Ничего больше в компоненте не менять (скрим, error-handler, fitBounds остаются как есть — они начинают работать сами, как только контейнер получает реальную высоту).

**Step 4: Run test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/offline-region-preview.test.mjs`

Expected: PASS (1 test).

**Step 5: Run the full server test suite (regression guard)**

Run: `node scripts/run-node-tests.mjs tests/server`

Expected: все тесты зелёные.

**Step 6: Lint (blocker per project rules)**

Run: `pnpm lint:fix`, затем `pnpm lint:source`

Expected: ноль новых ошибок.

**Step 7: Commit**

```bash
git add components/offline/region-preview.vue tests/server/offline-region-preview.test.mjs
git commit -m "fix(offline): size region preview map container explicitly

maplibre-gl.css sets .maplibregl-map { position: relative } and loads after
Tailwind, overriding the container's absolute class — inset-0 stopped sizing
the element, its height collapsed to 0 and the preview showed only the gray
panel background while the loading scrim never cleared. Use h-full w-full
like the explore Mapbox map so sizing is independent of the library CSS."
```

(Коммит строго от имени `sad1k <misha.kirillov.0990@gmail.com>`, без AI-футеров.)

---

### Task 2: Живая верификация в браузере

**Files:** нет изменений кода — только проверка.

**Step 1: Start dev server**

Use preview tools: `preview_start` с конфигом `nuxt-dev-alt` (порт 3011; основной 3001 обычно занят пользовательским сервером). Конфиг уже есть в `.claude/launch.json`.

**Step 2: Download a test region through the real pipeline**

Открыть `/offline`, затем через `preview_eval`:

```js
(async () => {
  const store = await import('/_nuxt/lib/offline/region-store.ts');
  const dl = await import('/_nuxt/lib/offline/region-downloader.ts');
  const bbox = [37.60, 55.74, 37.64, 55.76]; // центр Москвы, ~26 тайлов
  const region = await store.addRegion({ bbox, estimatedBytes: 0, pointCount: 0, regionLabel: 'verify-fix', status: 'metadata' });
  const result = await dl.downloadRegion({ regionId: region.id, bbox });
  return { regionId: region.id, result };
})()
```

Expected: `{ tilesDone: 26, totalTiles: 26, cancelled: false }` (если регион `verify-fix`/`repro-test` уже есть в IndexedDB с прошлого запуска — пропустить шаг).

**Step 3: Open the preview and assert geometry**

Перезагрузить страницу, кликнуть регион (`button[aria-label="Открыть verify-fix"]`), подождать ~2с, затем `preview_eval`:

```js
(() => {
  const mapDiv = document.querySelector('.maplibregl-map');
  const canvas = document.querySelector('.maplibregl-canvas');
  const scrim = document.querySelector('.explore-loading-scrim');
  const r = mapDiv ? mapDiv.getBoundingClientRect() : null;
  return {
    mapRect: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    canvasSize: canvas ? { w: canvas.width, h: canvas.height } : null,
    scrimGone: !scrim,
  };
})()
```

Expected: `mapRect.h > 400` (до фикса было `0`), `canvasSize.h` ≈ `mapRect.h` (не дефолтные 300).

**Known caveat:** headless-превью браузер приостанавливает rAF у скрытого окна — Vue-transition может зависнуть в `enter-from` (opacity 0), `load` не сработает и `scrimGone` останется `false`, а скриншот может таймаутиться. Это артефакт стенда, не регрессия. Решающий критерий на стенде — **геометрия** (`mapRect.h > 400`). Если скрим не ушёл и скриншот недоступен — финальную визуальную проверку сделать в реальном браузере пользователя: открыть `http://localhost:3001/offline`, выбрать скачанный регион, убедиться что дороги/вода/здания отрисованы и скрим исчез.

**Step 4: Report**

Зафиксировать результат проверки (геометрия + скриншот, если окружение позволяет) в ответе пользователю. Кода не менять; если геометрия не выросла — STOP, вернуться к диагностике.

---

## Done criteria

- `node scripts/run-node-tests.mjs tests/server` — зелёный.
- `pnpm lint:source` — ноль новых ошибок.
- `.maplibregl-map` в превью имеет высоту > 0; в реальном браузере виден рендер тайлов из IndexedDB.
- Один fix-коммит + закоммиченный план; untracked мусор (`.agents/`, `*.bak`, `skills-lock.json`) не тронут.
