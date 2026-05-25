# Mobile Route Step Carousel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a mobile-only swipeable carousel of route-step cards under the map on `/explore`, synced with map camera and existing place-bottom-sheet, and relocate the wizard collapsed chip into the top context row so the carousel claims the bottom space.

**Architecture:** New `components/explore/route-step-carousel.vue` mounted in `pages/explore.vue`. Active step is the pre-existing `useState("explore-selected-story-route-point-id")`. Swipe drives `selectedStoryRoutePointId` via native CSS scroll-snap + `IntersectionObserver`; a new watcher in `pages/explore.vue` translates that into `mapbox.flyToPoint(point)`. The collapsed wizard badge gets a mobile breakpoint variant via Tailwind classes on the existing `components/explore/wizard.vue` — no new component.

**Tech Stack:** Vue 3 + Nuxt 3, Tailwind CSS v4, Mapbox GL JS, `@nuxt/icon` (tabler). No new dependencies.

**Reference design:** `docs/plans/2026-05-24-mobile-route-step-carousel-design.md`.

**Gates per task:** `pnpm lint:source` and `pnpm typecheck` must pass. Each task ends with a commit. Last task does full manual verification via the preview MCP tool.

---

## Task 1: Add `flyToPoint` helper to mapbox composable

**Files:**
- Modify: `composables/use-mapbox.ts` (insert near `centerMap` at line 610; export it in the return at lines 733-749)

**Step 1: Add the helper function**

Insert after `centerMap` (line 629):

```ts
function flyToPoint(point: { lat: number; lng: number }, options?: { zoom?: number; duration?: number }) {
  const map = mapInstance.value;
  if (!map)
    return;

  spinning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  map.flyTo({
    center: [point.lng, point.lat],
    zoom: options?.zoom ?? Math.max(map.getZoom(), 14),
    duration: options?.duration ?? 600,
  });
}
```

The `Math.max(map.getZoom(), 14)` keeps the user's chosen zoom if they were already close-in, otherwise lifts to 14.

**Step 2: Export it**

In the `return { ... }` block at lines 733-749, add `flyToPoint,` after `centerMap,`.

**Step 3: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add composables/use-mapbox.ts
git commit -m "feat(explore): add flyToPoint helper to mapbox composable"
```

---

## Task 2: Scaffold the carousel component + mount it

**Files:**
- Create: `components/explore/route-step-carousel.vue`
- Modify: `pages/explore.vue` (add `<ExploreRouteStepCarousel />` near the existing `<ExplorePlaceBottomSheet />`)

**Step 1: Create the empty scaffold**

```vue
<script lang="ts" setup>
import {
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const aiRouteSession = useAiRouteSession();
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);

const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));

const showCarousel = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));
</script>

<template>
  <section
    v-if="showCarousel"
    class="route-step-carousel pointer-events-auto fixed inset-x-0 bottom-[80px] z-30 md:hidden"
    data-testid="explore-route-step-carousel"
  >
    <div class="px-3 py-2 text-xs">
      <!-- scaffold: {{ selectedRoutePoints.length }} stops -->
      stops: {{ selectedRoutePoints.length }}
    </div>
  </section>
</template>
```

The `bottom-[80px]` clears the mobile toolbar. `md:hidden` keeps this mobile-only.

**Step 2: Mount in pages/explore.vue**

In `pages/explore.vue` around line 316 (just after `<ExplorePlaceBottomSheet ... />` closing tag), add:

```vue
<ExploreRouteStepCarousel />
```

Nuxt auto-imports based on directory structure — no manual import needed.

**Step 3: Verify lint + types**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add components/explore/route-step-carousel.vue pages/explore.vue
git commit -m "feat(explore): scaffold mobile route step carousel"
```

---

## Task 3: Render step cards with content

**Files:**
- Modify: `components/explore/route-step-carousel.vue`

**Step 1: Extend the script setup**

Replace the script setup with:

```ts
<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

import {
  buildRouteLegs,
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const aiRouteSession = useAiRouteSession();
const placeIntelligence = usePlaceIntelligence();
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);

const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const routeLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));

const showCarousel = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));

function legDistanceLabel(index: number): string {
  const leg = routeLegs.value[index];
  if (!leg?.knownDistanceLabel)
    return "";
  return leg.knownDistanceLabel;
}

function isLast(index: number): boolean {
  return index === selectedRoutePoints.value.length - 1;
}

function onSelectCard(point: RouteMapPoint) {
  selectedStoryRoutePointId.value = point.sourceId;
}

const emit = defineEmits<{
  openDetails: [point: RouteMapPoint];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
}>();
</script>
```

**Step 2: Replace the template body**

```vue
<template>
  <section
    v-if="showCarousel"
    class="route-step-carousel pointer-events-auto fixed inset-x-0 bottom-[80px] z-30 md:hidden"
    data-testid="explore-route-step-carousel"
  >
    <ol
      class="route-step-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[10vw] pb-3 pt-2"
      data-testid="explore-route-step-track"
    >
      <li
        v-for="(point, index) in selectedRoutePoints"
        :key="point.id"
        class="route-step-card-slot snap-center shrink-0 px-1.5"
        style="flex-basis: 84%;"
      >
        <button
          class="route-step-card explore-card group flex w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition"
          :class="point.sourceId === selectedStoryRoutePointId ? 'route-step-card-active' : ''"
          type="button"
          @click="onSelectCard(point); emit('openDetails', point)"
        >
          <div class="route-step-thumb flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <Icon class="explore-text-faint" name="tabler:photo" size="22" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]"
                :class="isLast(index)
                  ? 'bg-brand-sangria text-[var(--explore-primary-text)]'
                  : point.sourceId === selectedStoryRoutePointId
                    ? 'bg-brand-emerald text-[var(--explore-primary-text)]'
                    : 'explore-route-stop-marker border'"
              >
                {{ index + 1 }}
              </span>
              <span class="explore-text truncate text-sm font-semibold">{{ point.name }}</span>
            </div>
            <div class="explore-text-soft mt-1.5 flex items-center gap-2 text-[11px]">
              <span class="flex items-center gap-1">
                <Icon name="tabler:clock" size="11" />
                {{ point.estimatedDurationMinutes || 90 }} мин
              </span>
              <span v-if="legDistanceLabel(index)" class="flex items-center gap-1">
                <span class="h-0.5 w-0.5 rounded-full bg-[var(--explore-text-faint)]" />
                <Icon name="tabler:arrow-right" size="11" />
                {{ legDistanceLabel(index) }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <button
                aria-label="Сохранить место"
                class="route-step-action explore-chip flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition"
                type="button"
                @click.stop="emit('save', point)"
              >
                <Icon name="tabler:bookmark-plus" size="12" />
                <span>Сохранить</span>
              </button>
              <button
                aria-label="Маршрут к месту"
                class="route-step-action explore-chip flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition"
                type="button"
                @click.stop="emit('directions', point)"
              >
                <Icon name="tabler:navigation" size="12" />
                <span>К месту</span>
              </button>
            </div>
          </div>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.route-step-track::-webkit-scrollbar {
  display: none;
}
.route-step-track {
  scrollbar-width: none;
}
.route-step-card {
  background: var(--explore-surface-strong);
  border-color: var(--explore-border);
  box-shadow: 0 12px 28px var(--explore-shadow);
}
.route-step-card-active {
  border-color: color-mix(in srgb, var(--explore-accent-strong) 50%, transparent);
  box-shadow: 0 16px 36px var(--explore-overlay-shadow);
}
.route-step-thumb {
  background: var(--explore-surface);
  border: 1px solid var(--explore-border);
}
</style>
```

**Step 3: Wire the emitted events in pages/explore.vue**

In `pages/explore.vue`, replace `<ExploreRouteStepCarousel />` with:

```vue
<ExploreRouteStepCarousel
  @open-details="openPlaceSheet"
  @save="onSheetSave"
  @directions="onSheetDirections"
/>
```

`openPlaceSheet`, `onSheetSave`, `onSheetDirections` already exist in `pages/explore.vue` (lines 181, 209, 213).

**Step 4: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add components/explore/route-step-carousel.vue pages/explore.vue
git commit -m "feat(explore): render route step cards in mobile carousel"
```

---

## Task 4: Lazy-load card photos via placeIntelligence

**Files:**
- Modify: `components/explore/route-step-carousel.vue`

**Step 1: Cache intelligence per source id**

In the script setup, add after the existing computed declarations:

```ts
const intelligenceCache = ref<Record<string, { heroImage?: string | null }>>({});

async function ensureIntelligenceFor(point: RouteMapPoint) {
  if (intelligenceCache.value[point.sourceId])
    return;
  if (point.markerKind !== "generated")
    return;
  try {
    const intelligence = await placeIntelligence.loadForRoutePoint(point, aiRouteSession.activeVariantId.value);
    intelligenceCache.value = {
      ...intelligenceCache.value,
      [point.sourceId]: { heroImage: intelligence?.heroImage ?? null },
    };
  }
  catch {
    intelligenceCache.value = {
      ...intelligenceCache.value,
      [point.sourceId]: { heroImage: null },
    };
  }
}

function heroImageFor(point: RouteMapPoint): string | null {
  return intelligenceCache.value[point.sourceId]?.heroImage ?? null;
}
```

**Step 2: Preload active step plus neighbours**

Add after the cache helpers:

```ts
watch(
  [selectedStoryRoutePointId, selectedRoutePoints],
  ([activeId, points]) => {
    const activeIndex = points.findIndex(p => p.sourceId === activeId);
    if (activeIndex < 0)
      return;
    const slice = [
      points[activeIndex - 1],
      points[activeIndex],
      points[activeIndex + 1],
    ].filter((p): p is RouteMapPoint => Boolean(p));
    slice.forEach(point => void ensureIntelligenceFor(point));
  },
  { immediate: true },
);
```

**Step 3: Replace the thumb slot in the template**

Replace the existing `.route-step-thumb` div with:

```vue
<div class="route-step-thumb flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
  <img
    v-if="heroImageFor(point)"
    :alt="point.name"
    class="h-full w-full object-cover"
    loading="lazy"
    :src="heroImageFor(point) ?? ''"
  >
  <Icon
    v-else
    class="explore-text-faint"
    name="tabler:photo"
    size="22"
  />
</div>
```

**Step 4: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add components/explore/route-step-carousel.vue
git commit -m "feat(explore): lazy-load photos for active carousel step + neighbours"
```

---

## Task 5: Header chrome — handle, day-chips, progress

**Files:**
- Modify: `components/explore/route-step-carousel.vue`

**Step 1: Compute header state**

Add to script setup:

```ts
import { getRouteDayGroups } from "~/lib/explore/route-map";

const routeDayGroups = computed(() => getRouteDayGroups(routeMapPoints.value));

const activeIndex = computed(() => selectedRoutePoints.value.findIndex(
  p => p.sourceId === selectedStoryRoutePointId.value,
));

const headerLabel = computed(() => {
  if (aiRouteSession.isGenerating.value)
    return "Генерируем маршрут…";

  const total = selectedRoutePoints.value.length;
  if (!total)
    return "";

  const stepIndex = Math.max(0, activeIndex.value);
  const point = selectedRoutePoints.value[stepIndex];
  if (!point)
    return `Шаг 1 из ${total}`;

  return `День ${point.day} · Шаг ${stepIndex + 1} из ${total}`;
});

function setDay(day: number | null) {
  selectedDay.value = day;
}
```

**Step 2: Insert the header above the track in the template**

Inside the `<section>` but before the `<ol>`, add:

```vue
<header class="route-step-header flex flex-col gap-1.5 px-3 pt-1">
  <div class="route-step-handle mx-auto h-1.5 w-10 rounded-full" />

  <div
    v-if="routeDayGroups.length > 1"
    class="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5"
  >
    <button
      class="route-step-day-chip explore-chip flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition"
      :class="selectedDay === null ? 'explore-chip-active' : ''"
      type="button"
      @click="setDay(null)"
    >
      Все
    </button>
    <button
      v-for="group in routeDayGroups"
      :key="group.day"
      class="route-step-day-chip explore-chip flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition"
      :class="selectedDay === group.day ? 'explore-chip-active' : ''"
      type="button"
      @click="setDay(group.day)"
    >
      Д{{ group.day }}
    </button>
  </div>

  <div class="flex items-center justify-between">
    <span class="explore-text-soft text-[11px] font-medium">{{ headerLabel }}</span>
    <div v-if="selectedRoutePoints.length > 1" class="flex items-center gap-1">
      <span
        v-for="(_, index) in selectedRoutePoints"
        :key="index"
        class="h-1 rounded-full transition-all"
        :class="index === Math.max(0, activeIndex)
          ? 'w-3 bg-[var(--explore-text)]'
          : 'w-1 bg-[var(--explore-border-strong)]'"
      />
    </div>
  </div>
</header>
```

**Step 3: Add scoped CSS at the bottom of the existing `<style scoped>` block**

```css
.route-step-handle {
  background: var(--explore-border-strong);
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}
```

**Step 4: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add components/explore/route-step-carousel.vue
git commit -m "feat(explore): carousel header with handle, day chips, progress"
```

---

## Task 6: Scroll-snap detection + reverse-sync

**Files:**
- Modify: `components/explore/route-step-carousel.vue`

**Step 1: Add the track ref and IntersectionObserver**

In script setup add:

```ts
const trackRef = ref<HTMLElement | null>(null);
const cardRefs = ref<Record<string, HTMLElement>>({});
let observer: IntersectionObserver | null = null;
let lastIntersectFromScroll = false;

function registerCard(point: RouteMapPoint, el: Element | null) {
  if (!el) {
    delete cardRefs.value[point.sourceId];
    return;
  }
  cardRefs.value[point.sourceId] = el as HTMLElement;
}

function setupObserver() {
  if (!import.meta.client)
    return;
  observer?.disconnect();
  if (!trackRef.value)
    return;

  observer = new IntersectionObserver(
    (entries) => {
      if (!lastIntersectFromScroll)
        return;
      const top = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!top)
        return;
      const sourceId = (top.target as HTMLElement).dataset.sourceId;
      if (sourceId && sourceId !== selectedStoryRoutePointId.value)
        selectedStoryRoutePointId.value = sourceId;
    },
    { root: trackRef.value, threshold: [0.6, 0.9] },
  );

  Object.values(cardRefs.value).forEach(el => observer?.observe(el));
}

function onTrackScroll() {
  lastIntersectFromScroll = true;
}

onMounted(() => {
  setupObserver();
});

watch(selectedRoutePoints, async () => {
  await nextTick();
  setupObserver();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
```

**Step 2: Add reverse-sync watcher**

```ts
watch(selectedStoryRoutePointId, async (sourceId) => {
  if (!sourceId)
    return;
  await nextTick();
  const card = cardRefs.value[sourceId];
  if (!card)
    return;
  lastIntersectFromScroll = false;
  card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
});
```

**Step 3: Wire refs into the template**

On the `<ol>` add `ref="trackRef" @scroll.passive="onTrackScroll"`. On the `<li>` add `:ref="(el) => registerCard(point, el as Element | null)"` and `:data-source-id="point.sourceId"`.

**Step 4: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add components/explore/route-step-carousel.vue
git commit -m "feat(explore): swipe-to-select + reverse-sync for carousel"
```

---

## Task 7: Map camera watcher in `pages/explore.vue`

**Files:**
- Modify: `pages/explore.vue`

**Step 1: Add `isCarouselDriven` flag and `flyToPoint` watcher**

After the existing `lastCompletedFitKey` declaration (around line 27), add:

```ts
const isCarouselDriven = ref(false);
let carouselFlyToTimer: ReturnType<typeof setTimeout> | null = null;
```

Add a watcher near the other watchers in the script (after the `selectedRoutePoints / selectedRouteLegs / isGenerating` watcher block):

```ts
watch(selectedStoryRoutePointId, (sourceId) => {
  if (!sourceId || !mapbox.mapLoaded.value)
    return;
  const point = selectedRoutePoints.value.find(p => p.sourceId === sourceId);
  if (!point)
    return;

  isCarouselDriven.value = true;
  if (carouselFlyToTimer)
    clearTimeout(carouselFlyToTimer);
  carouselFlyToTimer = setTimeout(() => {
    isCarouselDriven.value = false;
  }, 800);

  mapbox.flyToPoint({ lat: point.lat, lng: point.lng });
});
```

**Step 2: Suppress the fit-to-route watcher when carousel-driven**

In the existing `watch([selectedRoutePoints, selectedRouteLegs, isGenerating, mapbox.mapLoaded], ...)` block (around line 75), inside the callback near the top after `if (!mapbox.mapLoaded.value) return;`, add:

```ts
if (isCarouselDriven.value)
  return;
```

This stops `fitToRoute` from snapping the camera back while the user is paging through cards.

**Step 3: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add pages/explore.vue
git commit -m "feat(explore): fly map camera to active carousel step"
```

---

## Task 8: Relocate wizard chip on mobile + condense text

**Files:**
- Modify: `components/explore/wizard.vue`

**Step 1: Compute condensed mobile summary**

In `wizard.vue` after the existing `interestsSummary` computed (around line 42), add:

```ts
const firstInterestLabel = computed(() => {
  const first = selectedInterests.value[0];
  if (!first)
    return null;
  return INTERESTS.find(item => item.value === first)?.label ?? null;
});
```

**Step 2: Adjust outer positioning when collapsed AND showRouteSession AND mobile**

Currently the outer wrapper at the template start (line 240) is:

```vue
<div class="pointer-events-none absolute bottom-[88px] left-1/2 z-[60] w-[min(96vw,520px)] -translate-x-1/2 md:bottom-6">
```

Replace it with:

```vue
<div
  class="pointer-events-none absolute z-[60] transition-all"
  :class="collapsed && showRouteSession
    ? 'left-3 top-[68px] max-w-[58vw] md:bottom-6 md:left-1/2 md:top-auto md:w-[min(96vw,520px)] md:-translate-x-1/2'
    : 'bottom-[88px] left-1/2 w-[min(96vw,520px)] -translate-x-1/2 md:bottom-6'"
>
```

When wizard is collapsed AND route is active AND mobile → pinned top-left under the search row. On `md:` → restores original behaviour (bottom-anchored).

**Step 3: Condense the collapsed badge text on mobile**

Find the existing collapsed badge (around lines 244-266). Replace the text content (the spans inside the button) with:

```vue
<Icon
  class="explore-wizard-accent-icon"
  name="tabler:map-pin"
  size="16"
/>
<span class="explore-text truncate">{{ selectedCity?.label || "Выберите город" }}</span>
<span class="explore-text-faint">·</span>
<span class="explore-text whitespace-nowrap">{{ selectedDays }} дн.</span>
<span v-if="firstInterestLabel" class="hidden xs:inline explore-text-faint">·</span>
<span v-if="firstInterestLabel" class="hidden xs:inline explore-text-soft truncate">{{ firstInterestLabel }}</span>
<span class="explore-text-faint max-md:hidden">·</span>
<span class="explore-text-soft truncate max-md:hidden">{{ interestsSummary }}</span>
<Icon
  class="explore-text-faint ml-1"
  name="tabler:pencil"
  size="14"
/>
```

Logic:
- On mobile: city + days + first interest (if there's room — `xs:` breakpoint hides it on the narrowest devices) + pencil. Categories shortened to single tag.
- On desktop (`md:` and up): old behaviour — full `interestsSummary` joined string.

If `xs` is not in the Tailwind config, drop the `hidden xs:inline` modifier and always show the first interest on mobile (will be tight on 320px but still readable).

**Step 4: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add components/explore/wizard.vue
git commit -m "feat(explore): relocate wizard chip to top row on mobile after generation"
```

---

## Task 9: Skeleton + error + warning states

**Files:**
- Modify: `components/explore/route-step-carousel.vue`

**Step 1: Conditional rendering in the template**

Replace the existing `<ol>` block with the following conditional structure:

```vue
<div
  v-if="aiRouteSession.lastWarning.value"
  class="route-step-warning explore-status-warning mx-3 mb-1 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px]"
>
  <Icon name="tabler:alert-triangle" size="13" />
  <span class="truncate">{{ aiRouteSession.lastWarning.value }}</span>
</div>

<div
  v-if="aiRouteSession.error.value"
  class="route-step-error explore-status-danger mx-3 my-2 flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-sm"
>
  <span class="truncate">{{ aiRouteSession.error.value }}</span>
  <button
    class="explore-primary-button h-8 shrink-0 rounded-full px-3 text-xs font-bold"
    type="button"
    @click="emit('retry')"
  >
    Повторить
  </button>
</div>

<ol
  v-else
  ref="trackRef"
  class="route-step-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[10vw] pb-3 pt-2"
  data-testid="explore-route-step-track"
  @scroll.passive="onTrackScroll"
>
  <li
    v-if="aiRouteSession.isGenerating.value && !selectedRoutePoints.length"
    v-for="i in 3"
    :key="`skeleton-${i}`"
    class="route-step-card-slot snap-center shrink-0 px-1.5"
    style="flex-basis: 84%;"
  >
    <div class="route-step-card route-step-skeleton flex w-full items-stretch gap-3 rounded-2xl border p-3">
      <div class="route-step-thumb h-16 w-16 shrink-0 rounded-xl" />
      <div class="min-w-0 flex-1 space-y-2">
        <div class="route-step-skeleton-bar h-3 w-2/3 rounded-full" />
        <div class="route-step-skeleton-bar h-2 w-1/2 rounded-full" />
        <div class="route-step-skeleton-bar h-6 w-3/4 rounded-full" />
      </div>
    </div>
  </li>

  <li
    v-for="(point, index) in selectedRoutePoints"
    :key="point.id"
    :ref="(el) => registerCard(point, el as Element | null)"
    :data-source-id="point.sourceId"
    class="route-step-card-slot snap-center shrink-0 px-1.5"
    style="flex-basis: 84%;"
  >
    <!-- (existing card button stays unchanged) -->
  </li>
</ol>
```

**Step 2: Add `retry` to the emit signature**

```ts
const emit = defineEmits<{
  openDetails: [point: RouteMapPoint];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
  retry: [];
}>();
```

**Step 3: Add skeleton CSS to the style block**

```css
.route-step-skeleton-bar,
.route-step-skeleton .route-step-thumb {
  background: linear-gradient(
    90deg,
    var(--explore-surface) 0%,
    var(--explore-surface-strong) 50%,
    var(--explore-surface) 100%
  );
  background-size: 200% 100%;
  animation: route-step-shimmer 1.4s ease-in-out infinite;
}
@keyframes route-step-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Step 4: Wire `retry` in pages/explore.vue**

Add `@retry="generateRoute"` to the carousel mount. If `generateRoute` is not yet imported into the page (it lives in `route-panel.vue`), add a thin wrapper:

```ts
async function regenerateRoute() {
  const { selectedCity, requestContext } = useExploreContext();
  if (!selectedCity.value)
    return;
  await aiRouteSession.generateRoute(requestContext.value);
}
```

And mount the carousel with `@retry="regenerateRoute"`. Pull `aiRouteSession` and `useExploreContext` into the existing script setup if not already there.

**Step 5: Verify**

Run: `pnpm lint:source`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add components/explore/route-step-carousel.vue pages/explore.vue
git commit -m "feat(explore): skeleton, error, warning states for carousel"
```

---

## Task 10: Manual verification + screenshot

**Files:** none modified — verification only.

**Step 1: Start the dev server**

Use the preview MCP tool: `preview_start`. Confirm it's running.

**Step 2: Navigate to /explore on a mobile viewport**

```
preview_resize → 390x844 (iPhone 14 viewport)
preview_eval → window.location.assign("/explore")
```

**Step 3: Generate a route and capture screenshots**

1. Fill the wizard (city, days, interests) and tap Generate.
2. Wait for `selectedRoutePoints.length > 0`.
3. `preview_snapshot` — confirm the carousel is rendered and the wizard chip moved to the top.
4. `preview_screenshot` — save proof image.
5. Simulate a swipe via `preview_eval`:
   ```js
   const track = document.querySelector('[data-testid="explore-route-step-track"]');
   track?.scrollBy({ left: track.clientWidth * 0.84, behavior: 'smooth' });
   ```
6. Wait ~700ms then `preview_snapshot` — confirm the active card has shifted and the map has flown (the map centre will have changed; check via `preview_eval` reading the map's current centre if exposed).

**Step 4: Run final gates**

```bash
pnpm lint:source
pnpm typecheck
```

Both must pass.

**Step 5: Commit any leftover formatting/lint fixes** (if `pnpm lint:fix` produced changes):

```bash
git add -A
git commit -m "chore(explore): final lint fixes for route step carousel"
```

(skip this commit if no changes)

---

## Done criteria

- `/explore` on mobile shows the carousel only when a route session is active.
- Swiping a card updates the active step, scrolls the carousel to centre that card, and flies the map camera to its marker.
- Tap on a card opens the existing `place-bottom-sheet`.
- Day chips filter the carousel; "Все" resets.
- Wizard collapsed chip lives in the top-left context row on mobile when a route is generated; tapping ✎ restores the bottom-anchored wizard for editing.
- Skeleton, error, warning states render per the design doc.
- `pnpm lint:source` and `pnpm typecheck` pass on `main`.
- Verified visually via the preview MCP tool.

## Non-goals (deferred)

- Geolocation auto-advance.
- Reorder / drag-to-edit inside the carousel.
- Updating the stale `«Маршрут Almaty завис»` warning placement — that is a separate follow-up (see design doc).
- Component unit tests — the project has no Vue test framework; verification is via lint + typecheck + preview MCP.
