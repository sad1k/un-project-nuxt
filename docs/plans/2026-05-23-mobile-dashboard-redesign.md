# Mobile Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the WanderLog dashboard usable on mobile by replacing the always-split map+list layout with a content-first list and a bottom-sheet map, redesigning the location list cards for vertical touch flow, and giving the bottom toolbar a primary creation FAB.

**Architecture:** Mobile-only redesign that leaves the `md+` split-view untouched. Introduces two new shared primitives (`ActionSheet`, `MapBottomSheet`) wrapping the existing `AppYndxMap`. Cards become single-tap-target rows; `mapStore` interactions move from `@mouseenter` magic to explicit "show on map" buttons.

**Tech Stack:** Nuxt 3, Vue 3, Pinia, Tailwind 4 + DaisyUI, `@nuxt/icon` (tabler), existing `mapStore` and `AppYndxMap` (Yandex maps wrapper).

**Design source:** [docs/plans/2026-05-23-mobile-dashboard-redesign-design.md](./2026-05-23-mobile-dashboard-redesign-design.md)

**Testing reality:** This codebase has no frontend test runner (only server `node:test`). Per-component unit tests would require introducing vitest + happy-dom + @vue/test-utils — explicitly out of scope. Verification per task is:
1. `npm run typecheck` passes for touched files.
2. `npm run lint:source` passes for touched files (or skip if pre-existing failures dominate — note in commit).
3. Manual smoke at `npm run dev` on a 375px viewport (Chrome DevTools mobile emulation).
4. Final pass against the pre-delivery checklist (last task).

**Commit cadence:** One commit per task. Commit message format: `feat(mobile-dashboard): <task summary>` or `refactor(mobile-dashboard): <task summary>`.

---

## Phase A — Shared primitives

### Task A1: Create `ActionSheet` primitive

**Files:**
- Create: `components/app/action-sheet.vue`

**Why first:** Both the FAB menu (Task C2) and the mobile delete-confirm (Task D1) need a bottom sheet. Build the primitive once.

**Spec:**
- Props: `open: boolean` (v-model), `title?: string`, `dismissable?: boolean` (default `true`).
- Slot: default — sheet body.
- Behavior: slides up from bottom with `motion-safe:transition-transform`. Backdrop `bg-black/40` covers the rest. Tap on backdrop or Escape key dismisses if `dismissable`. Focus trap inside sheet while open. Restore focus to trigger on close.
- Mounts to `<Teleport to="body">`.
- Safe area: `padding-bottom: env(safe-area-inset-bottom)`.
- z-index: `60` (above mobile toolbar at 50; below not yet).
- Visible only on mobile (`md:hidden`) — desktop callers should use a `<dialog>` instead.
- a11y: `role="dialog" aria-modal="true" aria-labelledby` (if title), close button with `aria-label="Закрыть"`.

**Step 1:** Write the component skeleton.

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean;
  title?: string;
  dismissable?: boolean;
}>(), { dismissable: true });

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheetRef = ref<HTMLElement | null>(null);
const titleId = useId();

function close() {
  if (!props.dismissable) return;
  emit("update:open", false);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(() => props.open, (open) => {
  if (open) {
    nextTick(() => sheetRef.value?.focus());
    document.addEventListener("keydown", onKey);
  } else {
    document.removeEventListener("keydown", onKey);
  }
});

onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="motion-safe:transition-opacity motion-safe:duration-200"
      leave-active-class="motion-safe:transition-opacity motion-safe:duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-black/40 md:hidden"
        @click="close"
      />
    </Transition>
    <Transition
      enter-active-class="motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out"
      leave-active-class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        ref="sheetRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        tabindex="-1"
        class="app-chrome-strong fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 outline-none md:hidden"
        @click.stop
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-chrome-border-strong)]" />
        <div v-if="title" :id="titleId" class="mb-3 text-base font-semibold tracking-tight">
          {{ title }}
        </div>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
```

**Step 2:** Verify build.

Run: `npm run typecheck 2>&1 | rg "action-sheet" -A 3`
Expected: no errors mentioning `action-sheet.vue`.

**Step 3:** Visual smoke. Add a temporary trigger in `pages/dashboard/index.vue` (a button + `<AppActionSheet v-model:open="x">`); verify open/close/backdrop tap/Escape work in mobile emulation. Remove the trigger before commit.

**Step 4:** Commit.

```bash
git add components/app/action-sheet.vue
git commit -m "feat(mobile-dashboard): add ActionSheet primitive"
```

---

### Task A2: Extend `mapStore` with sheet state

**Files:**
- Modify: `stores/map.ts` (or wherever `useMapStore` lives — find with `grep -r "defineStore.*map" stores/`)

**Why:** `MapBottomSheet` needs to react to "show on map" calls from `LocationCard` and from forms. State must be shared.

**Step 1:** Locate the store file.

Run: `Grep` for `defineStore("map"` or `useMapStore`.

**Step 2:** Add `mobileSheetState: "collapsed" | "peek" | "expanded"` (default `"collapsed"`) and helper actions:

```ts
const mobileSheetState = ref<"collapsed" | "peek" | "expanded">("collapsed");

function showMapPeek() {
  if (mobileSheetState.value === "collapsed") mobileSheetState.value = "peek";
}
function collapseMap() {
  mobileSheetState.value = "collapsed";
}
function toggleMobileSheet() {
  mobileSheetState.value = mobileSheetState.value === "collapsed" ? "peek" : "collapsed";
}
```

Export them from the store.

**Step 3:** `npm run typecheck` — expect no new errors.

**Step 4:** Commit.

```bash
git add stores/map.ts
git commit -m "feat(mobile-dashboard): add mobile sheet state to mapStore"
```

---

### Task A3: Create `MapBottomSheet` with three snap points

**Files:**
- Create: `components/app/map-bottom-sheet.vue`

**Spec:**
- Reads `mapStore.mobileSheetState` and `mapStore.flyToPoint`.
- Three snap heights: `collapsed` = 64px (handle only), `peek` = `60svh`, `expanded` = `calc(100svh - 4rem)` (leave room for top nav).
- Lazy mount `AppYndxMap`: only render the map child when state has ever been `peek` or `expanded` at least once (use a `hasMounted` ref). On collapse the map stays mounted (cheap) but unmount happens if user explicitly closes via a future "X" button — out of scope here.
- Handle bar shows live counter: read `mapStore.points.length` or equivalent count (verify field name when implementing; if not exposed, skip the counter and just show "Карта").
- Tap handle: `collapsed ↔ peek`. Long-press / drag-up: `peek → expanded`. Drag-down: `expanded → peek → collapsed`. For v1 skip true drag-gestures — use two tap zones: handle taps toggle, and a small `tabler:chevron-up` icon expands to full; `tabler:chevron-down` collapses.
- z-index: `40` (below toolbar at 50; below ActionSheet at 60 so action sheets can appear over map).
- `md:hidden`.

**Step 1:** Skeleton.

```vue
<script setup lang="ts">
const mapStore = useMapStore();
const hasMounted = ref(false);

watch(() => mapStore.mobileSheetState, (s) => {
  if (s !== "collapsed" && !hasMounted.value) hasMounted.value = true;
});

const heightClass = computed(() => {
  switch (mapStore.mobileSheetState) {
    case "collapsed": return "h-16";
    case "peek": return "h-[60svh]";
    case "expanded": return "h-[calc(100svh-4rem)]";
  }
  return "h-16";
});

function toggleCollapse() {
  mapStore.toggleMobileSheet();
}
function expandFull() {
  mapStore.mobileSheetState = "expanded";
}
function shrinkToPeek() {
  mapStore.mobileSheetState = "peek";
}

const counterLabel = computed(() => {
  // If mapStore exposes a points count, use it. Otherwise generic.
  const n = (mapStore as any).points?.length;
  return typeof n === "number" ? `📍 ${n} мест на карте` : "Карта";
});
</script>

<template>
  <aside
    class="app-chrome-strong fixed inset-x-0 bottom-0 z-40 border-t shadow-2xl motion-safe:transition-[height] motion-safe:duration-250 md:hidden"
    :class="heightClass"
    aria-label="Карта мест"
  >
    <button
      type="button"
      class="flex h-12 w-full items-center justify-between px-4 text-sm font-medium"
      :aria-expanded="mapStore.mobileSheetState !== 'collapsed'"
      :aria-label="mapStore.mobileSheetState === 'collapsed' ? 'Раскрыть карту' : 'Свернуть карту'"
      @click="toggleCollapse"
    >
      <span class="flex items-center gap-2">
        <Icon name="tabler:map-2" size="18" />
        {{ counterLabel }}
      </span>
      <span v-if="mapStore.mobileSheetState !== 'collapsed'" class="flex gap-1">
        <button
          v-if="mapStore.mobileSheetState === 'peek'"
          class="app-chrome-control rounded-md p-1.5"
          type="button"
          aria-label="Развернуть карту на весь экран"
          @click.stop="expandFull"
        >
          <Icon name="tabler:chevron-up" size="16" />
        </button>
        <button
          v-if="mapStore.mobileSheetState === 'expanded'"
          class="app-chrome-control rounded-md p-1.5"
          type="button"
          aria-label="Уменьшить карту"
          @click.stop="shrinkToPeek"
        >
          <Icon name="tabler:chevron-down" size="16" />
        </button>
      </span>
    </button>
    <div
      v-if="hasMounted"
      v-show="mapStore.mobileSheetState !== 'collapsed'"
      class="h-[calc(100%-3rem)] overflow-hidden"
    >
      <AppYndxMap class="h-full w-full" />
    </div>
  </aside>
</template>
```

**Step 2:** `npm run typecheck` and `npm run lint:source -- components/app/map-bottom-sheet.vue` (ignore pre-existing unrelated failures).

**Step 3:** Commit.

```bash
git add components/app/map-bottom-sheet.vue
git commit -m "feat(mobile-dashboard): add MapBottomSheet with three snap points"
```

---

### Task A4: Mount `MapBottomSheet` on dashboard routes only

**Files:**
- Modify: `layouts/default.vue`

**Step 1:** Read `layouts/default.vue` (already read in design phase).

**Step 2:** Add conditional mount. Compute `showMobileMap` for routes that today render the inline map (dashboard, dashboard children).

```vue
<script setup lang="ts">
// existing code...
const showMobileMap = computed(() => route.path === "/dashboard" || route.path.startsWith("/dashboard/"));
</script>

<template>
  <div class="app-shell min-h-screen">
    <AppNavBar />
    <div class="flex min-h-screen pt-16 pb-20 md:pb-0">
      <AppSideRail v-if="showSideRail" />
      <main class="flex min-w-0 flex-1 flex-col">
        <slot />
      </main>
    </div>
    <AppMobileToolbar />
    <AppMapBottomSheet v-if="showMobileMap" />
    <!-- ... PWA stack ... -->
  </div>
</template>
```

Note `pb-24` → `pb-20` to match new toolbar height. Sheet is `fixed` so does not occupy main flow.

**Step 3:** Verify in browser: `/dashboard` shows sheet handle at bottom, `/feed` does not, `/explore` does not.

**Step 4:** Commit.

```bash
git add layouts/default.vue
git commit -m "feat(mobile-dashboard): mount MapBottomSheet on dashboard routes"
```

---

### Task A5: Stop rendering inline `AppYndxMap` on mobile in `pages/dashboard.vue`

**Files:**
- Modify: `pages/dashboard.vue`

**Step 1:** Add `md:hidden`-equivalent guard. Two options:
  - Cleanest: wrap `<AppYndxMap>` in `<div class="hidden md:flex flex-1 overflow-hidden">`.

```vue
<template>
  <div class="flex min-h-[calc(100vh-4rem)] flex-1 bg-gray-50 text-gray-950 transition-colors duration-300 dark:bg-[#050505] dark:text-white">
    <div class="min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(243,209,158,0.18),transparent_34%),#f9fafb] transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,rgba(243,209,158,0.08),transparent_34%),#050505]">
      <div class="flex size-full flex-col md:flex-row" :class="{ 'md:flex-col': !EDIT_PAGES.includes(route.name?.toString() || '') }">
        <NuxtPage />
        <AppYndxMap
          :key="EDIT_PAGES.includes(route.name?.toString() || '') ? 'edit' : 'view'"
          class="hidden md:flex flex-1 overflow-hidden"
        />
      </div>
    </div>
  </div>
</template>
```

Note: the existing class logic was confusing — replicate carefully. Verify after change that desktop split layout still works on `md` width.

**Step 2:** Verify dev server at 375px: list area takes full width, no map visible inline, sheet handle visible at bottom. At ≥768px: split layout intact.

**Step 3:** Commit.

```bash
git add pages/dashboard.vue
git commit -m "refactor(mobile-dashboard): hide inline map on mobile dashboard"
```

---

## Phase B — Dashboard list

### Task B1: Refactor `LocationCard` to horizontal mobile variant

**Files:**
- Modify: `components/location-card.vue`

**Spec:**
- New layout on mobile: `flex h-auto items-stretch` with 72×72 thumbnail + text block + chevron + map-pin button.
- Drop all `hover:*` utilities. Drop `@mouseenter`/`@mouseleave`.
- Add `active:scale-[0.98]` and `active:bg-*`.
- Selection: `border-l-4 border-brand-gold` (instead of `ring`).
- Add explicit "show on map" button calling `mapStore.flyToPoint = mapPoint` AND `mapStore.showMapPeek()`.
- Desktop preserves vertical card look — wrap in `md:flex-col md:h-48 md:w-[280px]`.
- Thumbnail source: `mapPoint.imageUrl` if present, else `tabler:map-pin` glyph. If `MapPoint` type does not include `imageUrl`, extend it (Task B0a below).

**Step 0a — preflight:** Check the `MapPoint` type and helpers `createMapPointFromLocation` / `createMapPointFromLocationLog`. If they do not surface a thumbnail URL, add an optional `imageUrl?: string` to `MapPoint` and resolve in the helpers from `location.locationLogs[0]?.images[0]?.url` (verify schema field names). Commit this preflight separately:

```bash
git add lib/types.ts lib/utils/map-point.ts # or wherever
git commit -m "feat(mobile-dashboard): expose imageUrl on MapPoint"
```

**Step 1:** Implement the new template.

```vue
<script setup lang="ts">
import type { MapPoint } from "~/lib/types";

const { mapPoint } = defineProps<{ mapPoint: MapPoint }>();
const mapStore = useMapStore();

const selected = computed(() => isPointSelected(mapPoint, mapStore.selectedPoint));

function showOnMap(e: Event) {
  e.preventDefault();
  mapStore.flyToPoint = mapPoint;
  mapStore.showMapPeek?.();
}
</script>

<template>
  <NuxtLink
    :key="mapPoint.id"
    :to="mapPoint.to"
    class="group relative flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm motion-safe:transition-transform active:scale-[0.98] active:bg-gray-50 md:h-48 md:w-[280px] md:flex-col md:p-0 dark:border-white/10 dark:bg-white/5 dark:active:bg-white/10"
    :class="selected ? 'border-l-4 border-l-brand-gold' : ''"
  >
    <div class="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-emerald/30 to-brand-sangria/30 md:h-32 md:w-full md:rounded-b-none md:rounded-t-2xl">
      <img
        v-if="mapPoint.imageUrl"
        :src="mapPoint.imageUrl"
        :alt="mapPoint.name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
      <div v-else class="flex h-full w-full items-center justify-center text-white/80">
        <Icon name="tabler:map-pin" size="28" />
      </div>
    </div>
    <div class="flex min-w-0 flex-1 flex-col justify-center md:p-3">
      <slot name="top" />
      <h3 class="line-clamp-1 text-base font-semibold tracking-tight text-gray-900 md:text-xl dark:text-white">
        {{ mapPoint.name }}
      </h3>
      <p v-if="mapPoint.description" class="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
        {{ mapPoint.description }}
      </p>
    </div>
    <div class="flex shrink-0 flex-col items-center justify-center gap-1 md:hidden">
      <button
        type="button"
        aria-label="Показать на карте"
        class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border"
        @click="showOnMap"
      >
        <Icon name="tabler:map-pin" size="18" />
      </button>
      <Icon name="tabler:chevron-right" size="16" class="text-gray-400" />
    </div>
  </NuxtLink>
</template>
```

**Step 2:** Manual verify: tap on card navigates to detail; tap on map-pin button does NOT navigate but updates `mapStore`; on desktop the original 280×192 card look is preserved.

**Step 3:** Commit.

```bash
git add components/location-card.vue
git commit -m "refactor(mobile-dashboard): horizontal mobile LocationCard with explicit map button"
```

---

### Task B2: Vertical list layout in `pages/dashboard/index.vue`

**Files:**
- Modify: `pages/dashboard/index.vue`
- Modify: `assets/css/main.css` (remove old `.location-list` rule)

**Step 1:** In `pages/dashboard/index.vue` replace the wrapper class:

```vue
<div
  v-else-if="locations && locations.length > 0"
  class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
>
```

**Step 2:** In `assets/css/main.css` delete:

```css
.location-list {
  @apply flex flex-nowrap mt-4 gap-2 overflow-auto;
}
```

(After this rule is removed, callers using `class="location-list"` in `[slug].vue` and others must be migrated — see Task D2.)

**Step 3:** Header tweak — mobile-friendly stacking:

```vue
<div class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
  <div>
    <p class="mb-2 font-mono text-xs uppercase tracking-[0.28em] text-brand-gold/70">WanderLog</p>
    <h2 class="font-display text-2xl tracking-tight text-gray-950 sm:text-3xl dark:text-white">
      Твои сохранённые места
    </h2>
  </div>
  <NuxtLink
    class="btn w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20 transition active:scale-[0.98] hover:bg-teal-500 sm:w-auto"
    to="/dashboard/place-photo/new"
  >
    <Icon name="tabler:camera-plus" size="20" />
    Быстрое фото
  </NuxtLink>
</div>
```

**Step 4:** Empty state — stack vertically, full-width buttons:

```vue
<div v-else class="flex flex-col items-stretch gap-4 sm:items-start">
  <p class="font-light text-gray-600 dark:text-gray-400">
    Добавьте место, чтобы начать сохранять воспоминания.
  </p>
  <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <NuxtLink class="btn w-full border-none bg-brand-gold font-bold text-brand-dark hover:bg-white sm:w-auto sm:min-w-[160px]" to="/dashboard/place-photo/new">
      <Icon name="tabler:camera-plus" size="24" /> Быстрое фото
    </NuxtLink>
    <NuxtLink class="btn btn-outline w-full border-brand-emerald text-brand-emerald hover:border-brand-emerald hover:bg-brand-emerald hover:text-white sm:w-auto" to="/explore">
      <Icon name="tabler:compass" size="20" /> Исследовать карту
    </NuxtLink>
  </div>
</div>
```

**Step 5:** Verify at 375px: vertical list of horizontal cards, no horizontal scroll, full-width primary CTA.

**Step 6:** Commit.

```bash
git add pages/dashboard/index.vue assets/css/main.css
git commit -m "refactor(mobile-dashboard): vertical list layout + mobile header stacking"
```

---

## Phase C — Mobile toolbar + FAB

### Task C1: Redesign `AppMobileToolbar` to 5 slots with central FAB

**Files:**
- Modify: `components/app/mobile-toolbar.vue`

**Spec:** items are `[Карта, Лента, FAB, Фото, Я]`. The center slot is the FAB (no route — opens action sheet). FAB is visually elevated (translate-y -8px, larger). All other slots ≥56pt high with 24pt icons and `text-[11px]` labels.

**Step 1:** Read existing component (already in context).

**Step 2:** Rewrite.

```vue
<script setup lang="ts">
const route = useRoute();
const fabOpen = ref(false);

const items = [
  { label: "Карта", icon: "tabler:map-2", to: "/explore" },
  { label: "Лента", icon: "tabler:world", to: "/feed" },
  { label: "Фото", icon: "tabler:camera", to: "/dashboard/place-photo/new" },
  { label: "Я", icon: "tabler:user", to: "/dashboard" },
];

function isActive(path: string) {
  if (path === "/dashboard")
    return route.path === "/dashboard" || route.path.startsWith("/dashboard/location");
  return route.path === path;
}

function openFab() { fabOpen.value = true; }
</script>

<template>
  <nav class="app-chrome pwa-bottom-toolbar fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-end border-t md:hidden">
    <NuxtLink
      v-for="(item, i) in items.slice(0, 2)"
      :key="item.to"
      :to="item.to"
      :aria-current="isActive(item.to) ? 'page' : undefined"
      class="flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium motion-safe:transition-transform active:scale-95"
      :class="isActive(item.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-faint'"
    >
      <Icon :name="item.icon" size="24" />
      <span class="truncate">{{ item.label }}</span>
      <span v-if="isActive(item.to)" class="h-1 w-1 rounded-full bg-[var(--app-active-accent)]" />
    </NuxtLink>

    <button
      type="button"
      aria-label="Создать"
      class="relative -mt-4 flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30 motion-safe:transition-transform active:scale-95"
      @click="openFab"
    >
      <Icon name="tabler:plus" size="28" />
    </button>

    <NuxtLink
      v-for="item in items.slice(2)"
      :key="item.to"
      :to="item.to"
      :aria-current="isActive(item.to) ? 'page' : undefined"
      class="flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium motion-safe:transition-transform active:scale-95"
      :class="isActive(item.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-faint'"
    >
      <Icon :name="item.icon" size="24" />
      <span class="truncate">{{ item.label }}</span>
      <span v-if="isActive(item.to)" class="h-1 w-1 rounded-full bg-[var(--app-active-accent)]" />
    </NuxtLink>

    <AppActionSheet v-model:open="fabOpen" title="Создать">
      <ul class="flex flex-col gap-1">
        <li>
          <NuxtLink to="/dashboard/add" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:map-pin-plus" size="22" />
            <div>
              <div class="text-sm font-semibold">Добавить место</div>
              <div class="text-xs text-gray-500">Сохранить локацию в дневник</div>
            </div>
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/dashboard/place-photo/new" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:camera-plus" size="22" />
            <div>
              <div class="text-sm font-semibold">Быстрое фото</div>
              <div class="text-xs text-gray-500">Прикрепить фото к месту</div>
            </div>
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/dashboard/publish" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:send" size="22" />
            <div>
              <div class="text-sm font-semibold">Опубликовать пост</div>
              <div class="text-xs text-gray-500">Поделиться с лентой</div>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </AppActionSheet>
  </nav>
</template>
```

**Step 3:** Update `pwa-bottom-toolbar` CSS in `main.css` — current rule keeps safe-area padding, which is still desired. No CSS change needed.

**Step 4:** Verify at 375px: 5 slots fit, FAB elevated and centered, action sheet opens on tap, items navigate, sheet closes after navigation.

**Step 5:** Commit.

```bash
git add components/app/mobile-toolbar.vue
git commit -m "feat(mobile-dashboard): 5-slot toolbar with central FAB and action sheet"
```

---

### Task C2: Adjust layout padding for new toolbar

**Files:**
- Modify: `layouts/default.vue` (already changed in A4; verify `pb-20` matches `h-16` toolbar + safe area)

**Step 1:** Confirm `pb-20` is sufficient: `h-16` toolbar (64px) + max(8px, safe-area). `pb-20` = 80px ≥ 72 = ok with small buffer for FAB elevation.

**Step 2:** No further change needed if A4 was done correctly. Skip commit.

---

## Phase D — Detail page

### Task D1: Sticky header + h1 fix + Vue-managed delete dialog

**Files:**
- Modify: `pages/dashboard/location/[slug].vue`
- Possibly: new tiny inline component or use `<dialog ref>` directly.

**Step 1:** Rewrite template (excerpt):

```vue
<script setup lang="ts">
// existing imports...
const deleteDialog = ref<HTMLDialogElement | null>(null);
function openDelete() { deleteDialog.value?.showModal(); }
function closeDelete() { deleteDialog.value?.close(); }
const mapStore = useMapStore();
function showOnMap() {
  if (location.value) {
    mapStore.flyToPoint = createMapPointFromLocation(location.value);
    mapStore.showMapPeek?.();
  }
}
// ... rest unchanged
</script>

<template>
  <div class="page-content-top">
    <header class="app-chrome sticky top-16 z-30 -mx-4 mb-3 flex h-12 items-center justify-between border-b px-4 md:hidden">
      <button type="button" class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Назад" @click="$router.back()">
        <Icon name="tabler:chevron-left" size="18" />
      </button>
      <div class="truncate px-3 text-sm font-semibold">
        {{ location?.name }}
      </div>
      <div class="dropdown dropdown-end">
        <button tabindex="0" type="button" class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Ещё">
          <Icon name="tabler:dots" size="18" />
        </button>
        <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-52 p-2 shadow">
          <li><button class="flex items-center gap-2 text-error" @click="openDelete">Удалить<Icon name="tabler:trash" size="18" /></button></li>
        </ul>
      </div>
    </header>

    <div v-if="loading"><span class="loading loading-spinner loading-xl" /></div>
    <div v-else-if="errorMessage"><p>{{ errorMessage }}</p></div>
    <div v-else-if="route.name === 'dashboard-location-slug'">
      <div v-if="location && !loading" class="max-w-prose">
        <h1 class="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">
          {{ location.name }}
        </h1>
        <p v-if="location.description" class="mt-2 break-words text-gray-600 dark:text-white/60">
          {{ location.description }}
        </p>
        <button type="button" class="app-chrome-control mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm md:hidden" @click="showOnMap">
          <Icon name="tabler:map-pin" size="16" /> Показать на карте
        </button>
      </div>

      <dialog ref="deleteDialog" class="modal">
        <div class="modal-box flex flex-col gap-4">
          <h3 class="text-lg font-bold">Вы уверены, что хотите удалить это место?</h3>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-error" @click="deleteLocation">Удалить</button>
            <button type="button" class="btn btn-outline" @click="closeDelete">Отмена</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="button">Отмена</button></form>
      </dialog>

      <!-- empty logs state and logs list - see Task D2 -->
    </div>

    <div><NuxtPage /></div>
  </div>
</template>
```

**Step 2:** Verify dropdown still works (DaisyUI dropdown needs `tabindex="0"` parent), delete dialog opens/closes via ref, no global `deleteLocationModal` reference remaining.

**Step 3:** Commit.

```bash
git add pages/dashboard/location/[slug].vue
git commit -m "refactor(mobile-dashboard): sticky header and Vue-managed delete dialog on location detail"
```

---

### Task D2: Migrate visit log list to new card + empty state

**Files:**
- Modify: `pages/dashboard/location/[slug].vue` (continue from D1)

**Step 1:** Replace the existing `<div class="location-list">` block:

```vue
<section class="mt-6">
  <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Посещения</h2>
  <div v-if="location && location.locationLogs?.length" class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
    <LocationCard
      v-for="log in location.locationLogs"
      :key="log.id"
      :map-point="createMapPointFromLocationLog(log, route.params.slug as string)"
    >
      <template #top>
        <span v-if="log.startedAt !== log.endedAt" class="text-xs italic text-gray-500">
          {{ formatDate(log.startedAt) }} – {{ formatDate(log.endedAt) }}
        </span>
        <span v-else class="text-xs italic text-gray-500">
          {{ formatDate(log.startedAt) }}
        </span>
      </template>
    </LocationCard>
  </div>
  <div v-else class="flex flex-col gap-3">
    <p class="text-gray-600 dark:text-white/60">Нет посещений. Добавьте первое.</p>
    <NuxtLink
      :to="{ name: 'dashboard-location-slug-add', params: { slug: route.params.slug } }"
      class="btn w-full border-none bg-brand-emerald text-white active:scale-[0.98] sm:w-auto"
    >
      + Добавить посещение
    </NuxtLink>
  </div>
</section>
```

**Step 2:** Verify both states render correctly.

**Step 3:** Commit.

```bash
git add pages/dashboard/location/[slug].vue
git commit -m "refactor(mobile-dashboard): migrate visit logs to new LocationCard"
```

---

## Phase E — Forms

### Task E1: Refactor `location-base-form.vue` for mobile

**Files:**
- Modify: `components/location-base-form.vue`

**Spec:**
- Helper-text becomes short `<p>` under coordinates (still inside the form for context).
- Sticky bottom action bar on mobile (full-width primary + text-link secondary).
- Desktop keeps inline buttons.

**Step 1:** Rewrite the actions block:

```vue
<!-- Desktop actions -->
<div class="mt-4 hidden justify-end gap-4 md:flex">
  <button :disabled="loading" type="submit" class="btn border-none bg-brand-gold text-brand-dark hover:bg-white">
    <span v-if="loading" class="loading loading-spinner loading-md" />
    <Icon v-else :name="props.submitButtonIcon || 'tabler:circle-plus-filled'" size="24" />
    {{ props.submitButtonText || "Добавить" }}
  </button>
  <button :disabled="loading" type="button" class="btn border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/20 dark:text-white" @click="router.back()">
    <Icon name="tabler:arrow-left" size="20" /> Отмена
  </button>
</div>

<!-- Mobile sticky bar - Teleport so it overlays toolbar context -->
<Teleport to="body">
  <div class="fixed inset-x-0 bottom-16 z-40 border-t app-chrome-strong px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
    <button :disabled="loading" type="submit" class="btn w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30 active:scale-[0.98]" @click="onSubmit">
      <span v-if="loading" class="loading loading-spinner loading-md" />
      <Icon v-else :name="props.submitButtonIcon || 'tabler:circle-plus-filled'" size="22" />
      {{ props.submitButtonText || "Добавить" }}
    </button>
    <button type="button" class="mt-2 block w-full text-center text-sm text-gray-500 active:text-gray-700 dark:text-white/60" @click="router.back()">
      Отмена
    </button>
  </div>
</Teleport>
```

Note: the mobile submit lives outside `<form>` due to Teleport, so it needs `@click="onSubmit"` instead of relying on form submission. Verify `onSubmit` is callable from outside the form context (it is — it's a vee-validate `handleSubmit` wrapper).

**Step 2:** Replace the info-card "Вы можете добавить место..." with compact helper text under coordinates. Keep the bulleted instructions list but reduce visual weight:

```vue
<p class="mt-2 text-xs leading-relaxed text-gray-500 dark:text-white/50">
  Перенесите маркер на карте, дважды коснитесь карты, или выберите место из списка ниже.
</p>
```

**Step 3:** Form root container — change to label-stack-friendly:

```vue
<form class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm md:p-6 dark:border-white/10 dark:bg-white/5" @submit.prevent="onSubmit">
  <slot :errors="errors" :loading="loading" />
  <p class="text-xs leading-relaxed text-gray-500 dark:text-white/50">
    Перенесите маркер, дважды коснитесь карты, или выберите место из списка ниже.
  </p>
  <p class="text-xs text-gray-400 dark:text-white/40">
    Координаты: {{ formatNumber(controlledValues.lat) }}, {{ formatNumber(controlledValues.long) }}
  </p>
  <!-- Desktop actions inside form -->
  <div class="hidden justify-end gap-4 md:flex">...</div>
</form>
```

**Step 4:** Verify form on mobile: sticky bar at bottom does not collide with mobile toolbar (bar at bottom-16 = above 64px toolbar). Submit works from both desktop and mobile button. Cancel does router.back().

**Step 5:** Commit.

```bash
git add components/location-base-form.vue
git commit -m "refactor(mobile-dashboard): mobile sticky action bar in location-base-form"
```

---

### Task E2: Replace `window.confirm` unsaved-changes guard with in-app modal

**Files:**
- Modify: `components/location-base-form.vue`

**Step 1:** Add a small `<dialog>` in the component for the leave-confirm:

```vue
<dialog ref="leaveDialog" class="modal">
  <div class="modal-box">
    <h3 class="text-lg font-bold">Покинуть форму?</h3>
    <p class="py-2 text-sm text-gray-600 dark:text-white/70">Все несохранённые изменения будут потеряны.</p>
    <div class="modal-action">
      <button type="button" class="btn btn-error" @click="confirmLeave">Покинуть</button>
      <button type="button" class="btn" @click="cancelLeave">Остаться</button>
    </div>
  </div>
</dialog>
```

**Step 2:** Replace the `onBeforeRouteLeave` body:

```ts
const leaveDialog = ref<HTMLDialogElement | null>(null);
let pendingLeave: (() => void) | null = null;

function confirmLeave() {
  pendingLeave?.();
  pendingLeave = null;
  leaveDialog.value?.close();
  mapStore.addedPoint = null;
}
function cancelLeave() {
  pendingLeave = null;
  leaveDialog.value?.close();
}

onBeforeRouteLeave((to) => {
  if (meta.value.dirty && !submitted.value) {
    return new Promise<boolean>((resolve) => {
      pendingLeave = () => resolve(true);
      leaveDialog.value?.showModal();
      const oncancel = () => { resolve(false); leaveDialog.value?.removeEventListener("close", oncancel); };
      leaveDialog.value?.addEventListener("close", oncancel, { once: true });
    });
  }
  mapStore.addedPoint = null;
  return true;
});
```

(Verify the promise-based `onBeforeRouteLeave` return type matches Vue Router expectations — it supports `boolean | Promise<boolean>`.)

**Step 3:** Verify: dirty form + navigate away triggers in-app dialog, "Покинуть" navigates, "Остаться" stays.

**Step 4:** Commit.

```bash
git add components/location-base-form.vue
git commit -m "refactor(mobile-dashboard): replace window.confirm with in-app leave dialog"
```

---

### Task E3: Focus first invalid field on submit

**Files:**
- Modify: `components/location-base-form.vue`

**Step 1:** After `setErrors(...)` in the catch block, find and focus the first invalid input:

```ts
nextTick(() => {
  const firstInvalid = document.querySelector<HTMLElement>("[aria-invalid='true'], .input-error, input:invalid");
  firstInvalid?.focus();
});
```

(The exact selector depends on how vee-validate marks fields — verify by inspecting after a failed submit. Adjust as needed.)

**Step 2:** Ensure form fields (slot content in `<LocationForm>`) set `:aria-invalid="!!errors.fieldName"`. This requires touching the slot consumers — open `components/location-form.vue` (the slot user) and add `:aria-invalid` to each field.

**Step 3:** Verify: submit empty form, focus jumps to first errored field.

**Step 4:** Commit.

```bash
git add components/location-base-form.vue components/location-form.vue
git commit -m "feat(mobile-dashboard): focus first invalid field on submit"
```

---

### Task E4: `add.vue` mobile-friendly container

**Files:**
- Modify: `pages/dashboard/add.vue`

**Step 1:** Change container:

```vue
<div class="w-full px-4 py-6 lg:mx-auto lg:max-w-2xl lg:px-6">
```

(Drop `max-w-2xl` on mobile so form uses the full viewport width.)

**Step 2:** Move h1 out of the form area into a page header block (already is — confirm structure).

**Step 3:** Verify at 375px: form uses full width, padding consistent at 16px.

**Step 4:** Commit.

```bash
git add pages/dashboard/add.vue
git commit -m "refactor(mobile-dashboard): full-width form on mobile add page"
```

---

### Task E5: Apply same container change to `[slug]/add.vue` and `[slug]/edit.vue`

**Files:**
- Modify: `pages/dashboard/location/[slug]/add.vue`
- Modify: `pages/dashboard/location/[slug]/edit.vue`
- Modify: `pages/dashboard/location/[slug]/[id]/edit.vue`

**Step 1:** Apply the same container pattern (`w-full px-4 ... lg:max-w-2xl`).

**Step 2:** Commit.

```bash
git add pages/dashboard/location/[slug]/add.vue pages/dashboard/location/[slug]/edit.vue pages/dashboard/location/[slug]/[id]/edit.vue
git commit -m "refactor(mobile-dashboard): full-width form on nested add/edit pages"
```

---

## Phase F — Polish & verification

### Task F1: Hover→touch sweep on dashboard surfaces

**Files:**
- Grep for remaining `hover:` utilities on tap targets in dashboard files.

**Step 1:** Run `Grep` for `hover:` in `components/location-card.vue`, `components/location-base-form.vue`, `components/app/mobile-toolbar.vue`, `pages/dashboard/**`. Confirm hover utilities are paired with `active:` equivalents (or removed for mobile-only surfaces).

**Step 2:** Replace any remaining mobile-relevant `hover:-translate-*` and `hover:scale-*` with `active:` versions.

**Step 3:** Commit if anything changed.

```bash
git commit -m "refactor(mobile-dashboard): replace remaining hover-only feedback with active states"
```

---

### Task F2: Pre-delivery checklist run

**Files:** none modified; this is a verification gate.

**Step 1:** Open `npm run dev`, switch to Chrome DevTools mobile emulation. Walk each item from the design doc's pre-delivery checklist:
- [ ] 375×667, 390×844, 412×915 verified.
- [ ] Landscape: sheet does not block content.
- [ ] Dark mode (toggle via `AppThemeToggle`) verified independently.
- [ ] `prefers-reduced-motion`: enable in DevTools rendering panel; sheet/FAB animations snap.
- [ ] Zoom 200%: layout intact.
- [ ] Safe-area: emulate iPhone 14 Pro (has notch); header and toolbar respect insets.
- [ ] Keyboard: Tab cycles in expected order, Escape closes sheet and dialog.
- [ ] PWA install banner and offline pill (`pwa-shell-stack`) do not overlap toolbar — adjust `bottom` if needed.

**Step 2:** Run `npm run typecheck` for touched files; resolve any new errors.

**Step 3:** Run `npm run lint:source` for touched files; resolve new errors (pre-existing failures are noted in PROJECT.md as blocked — leave them).

**Step 4:** Final commit if anything was tweaked.

```bash
git commit -m "chore(mobile-dashboard): pre-delivery checklist fixes"
```

---

## Summary

- 14 implementation tasks across 6 phases.
- Estimated 4–8 hours of focused work.
- No new dependencies.
- No frontend test infrastructure introduced — manual verification per task + final checklist.
- All changes gated on mobile breakpoints (`md:hidden` / `md:flex`) so the desktop layout is preserved.

## Risks to revisit during execution

- `AppYndxMap` lifecycle: unmount/remount inside sheet may break the GL context. If the map flickers or loses state when first opened, switch to `v-show` (keep mounted) instead of lazy `v-if`.
- DaisyUI dropdown in sticky header: may conflict with `overflow: hidden` on the header. If dropdown gets clipped, use `<Teleport>` or a custom popover.
- Mobile sticky form action bar covers the bottom toolbar's z-index space — make sure `bottom-16` keeps it above toolbar without overlapping.
- `mapStore.points` may not exist; counter label in `MapBottomSheet` was wrapped with `(mapStore as any).points?.length` — replace with actual store getter when implementing A3.
