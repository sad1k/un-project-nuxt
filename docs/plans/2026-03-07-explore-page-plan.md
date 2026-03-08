# Explore Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-screen Mapbox GL JS travel route planner page at `/explore` with mock AI route generation, custom markers, animated route lines, and glassmorphic UI overlays.

**Architecture:** Single page (`pages/explore.vue`) with layout disabled, composing 4 overlay components on top of a client-only Mapbox map. Two composables handle map instance management and mock route generation. All state is local (no Pinia store needed).

**Tech Stack:** Nuxt 3, Mapbox GL JS (`mapbox-gl` npm package), Tailwind CSS v4 + DaisyUI, Nuxt Icon (`tabler` icons)

**Design doc:** `docs/plans/2026-03-07-explore-page-design.md`

---

### Task 1: Install mapbox-gl and configure token

**Files:**
- Modify: `package.json`
- Modify: `nuxt.config.ts:40-45` (runtimeConfig.public)
- Modify: `lib/env.ts` (add MAPBOX_TOKEN)

**Step 1: Install mapbox-gl**

Run: `pnpm add mapbox-gl`

**Step 2: Add MAPBOX_TOKEN to env schema**

In `lib/env.ts`, add `MAPBOX_TOKEN` to the env schema (check current pattern — it likely uses zod).

**Step 3: Add to runtimeConfig**

In `nuxt.config.ts`, add to `runtimeConfig.public`:

```ts
runtimeConfig: {
  public: {
    s3BucketUrl: env.S3_BUCKET_URL,
    sentryDsn: env.SENTRY_DSN,
    mapboxToken: env.MAPBOX_TOKEN,  // <-- add this
  },
},
```

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml nuxt.config.ts lib/env.ts
git commit -m "feat(explore): install mapbox-gl and configure token"
```

---

### Task 2: Create useRouteGenerator composable

**Files:**
- Create: `composables/useRouteGenerator.ts`

**Step 1: Create the composable with mock data and generation logic**

```ts
type RoutePoint = {
  id: string
  day: number
  name: string
  type: 'culture' | 'food' | 'nature' | 'adventure' | 'art' | 'nightlife'
  lat: number
  lng: number
  emoji: string
}

type RouteStats = {
  estimatedHours: number
  placeCount: number
  matchPercentage: number
}
```

**Mock data to include:**

Tokyo (9 points, 3 days):
- Day 1: Senso-ji Temple (culture, 35.7148, 139.7967), Tsukiji Outer Market (food, 35.6654, 139.7707), Meiji Shrine (culture, 35.6764, 139.6993)
- Day 2: Shibuya Crossing (adventure, 35.6595, 139.7004), Akihabara (art, 35.7023, 139.7745), Ueno Park (nature, 35.7146, 139.7732)
- Day 3: Tokyo Tower (culture, 35.6586, 139.7454), Shinjuku Gyoen (nature, 35.6852, 139.7100), Golden Gai (nightlife, 35.6938, 139.7036)

Paris (8 points, 3 days):
- Day 1: Eiffel Tower (culture, 48.8584, 2.2945), Louvre Museum (art, 48.8606, 2.3376), Champs-Elysees (adventure, 48.8698, 2.3075)
- Day 2: Montmartre (culture, 48.8867, 2.3431), Sacre-Coeur (culture, 48.8867, 2.3431), Cafe de Flore (food, 48.8540, 2.3325)
- Day 3: Notre-Dame (culture, 48.8530, 2.3499), Jardin du Luxembourg (nature, 48.8462, 2.3372)

Fallback (5 points, 2 days):
- Day 1: City Center, Local Market, Central Park
- Day 2: National Museum, Sunset Viewpoint

**Logic:**
- `destination` ref (string)
- `selectedDays` ref (number, default 3)
- `selectedInterests` ref (Set of strings)
- `generating` ref (boolean)
- `points` ref (RoutePoint[])
- `generate()` — match destination, filter by days (cap at 3), set 2s timeout, update points
- `stats` computed — derive from points.length

**Step 2: Commit**

```bash
git add composables/useRouteGenerator.ts
git commit -m "feat(explore): add useRouteGenerator composable with mock data"
```

---

### Task 3: Create useMapbox composable

**Files:**
- Create: `composables/useMapbox.ts`

**Step 1: Create the composable for map instance management**

This composable manages:
- `mapInstance` shallowRef — the mapboxgl.Map
- `mapLoaded` ref (boolean)
- `activeMarkers` array — for clearing
- `animationFrameId` — for route line animation and globe spin

**Functions:**

`initMap(container: HTMLElement, token: string)`:
- Create `new mapboxgl.Map` with globe projection, light-v11 style, pitch 45, bearing -17.6, center [30, 15], zoom 1.5
- Add NavigationControl to bottom-right
- Set fog (warm-toned)
- On `load` event: set mapLoaded = true
- Setup auto-spin: on `idle`, if zoom < 4, start requestAnimationFrame rotating center.lng += 0.01. On mousedown/touchstart/wheel, pause. Resume after 3s timeout.

`clearMarkers()`:
- Remove all markers from activeMarkers array

`addMarkers(points: RoutePoint[])`:
- Clear existing markers first
- For each point, create custom DOM element (32x32 gradient circle with number)
- Create mapboxgl.Marker({ element }) and add to map
- Add mouseenter/mouseleave for popup (day badge, name, type dot)
- Stagger animation-delay by index * 150ms
- Push to activeMarkers

`drawRouteLine(points: RoutePoint[])`:
- Remove existing 'route' source/layer if present
- Add GeoJSON LineString source
- Add line layer: dashed, amber-500, width 3
- Start requestAnimationFrame dash animation

`fitToRoute(points: RoutePoint[])`:
- Calculate LngLatBounds from all points
- map.fitBounds with padding { top: 100, bottom: 80, left: 420, right: 80 }, duration 1500

`destroy()`:
- Cancel animation frames
- Remove map

**Step 2: Commit**

```bash
git add composables/useMapbox.ts
git commit -m "feat(explore): add useMapbox composable for map management"
```

---

### Task 4: Create MapView.client.vue

**Files:**
- Create: `components/explore/MapView.client.vue`

**Step 1: Create the client-only map component**

```vue
<script lang="ts" setup>
// Import mapbox-gl and its CSS
// Get mapbox token from useRuntimeConfig()
// Get container ref
// On mounted: call useMapbox().initMap(container, token)
// On unmount: call destroy()
// Expose mapLoaded
</script>

<template>
  <div ref="mapContainer" class="absolute inset-0" />
</template>
```

Key points:
- Import `mapbox-gl/dist/mapbox-gl.css` for Mapbox styles
- The component is just a container div — all map logic lives in `useMapbox.ts`
- Emits `loaded` event when map fires `load`

**Step 2: Commit**

```bash
git add components/explore/MapView.client.vue
git commit -m "feat(explore): add MapView client component"
```

---

### Task 5: Create HeaderOverlay.vue

**Files:**
- Create: `components/explore/HeaderOverlay.vue`

**Step 1: Create the header overlay**

Structure:
- Outer div: `absolute top-0 inset-x-0 z-30 px-6 py-4 flex justify-between items-center`
- Left: flex row — 40x40 rounded-xl div with `bg-gradient-to-br from-amber-400 to-orange-500` containing compass icon, then "Wanderlust" span in `font-headline text-white text-xl`
- Center: flex row gap-6 — three anchor tags: "Explore" (text-white, border-b-2 border-amber-400), "My Trips" (text-white/60 hover:text-white/80), "Saved" (same)
- Right: flex row gap-3 — search icon button (w-10 h-10 bg-white/10 backdrop-blur rounded-full) + avatar div (w-10 h-10 bg-gray-400 rounded-full)

All links/buttons are visual only (`href="#"`).

**Step 2: Commit**

```bash
git add components/explore/HeaderOverlay.vue
git commit -m "feat(explore): add header overlay component"
```

---

### Task 6: Create QuickActions.vue

**Files:**
- Create: `components/explore/QuickActions.vue`

**Step 1: Create the right sidebar**

Structure:
- Outer div: `absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3`
- 4 buttons, each: `w-11 h-11 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 flex items-center justify-center hover:bg-white hover:scale-105 hover:shadow-xl transition-all duration-200`
- Icons (using Nuxt Icon): `tabler:history`, `tabler:bookmark`, `tabler:share`, `tabler:settings`
- Icon size: 20, color: text-gray-600

All buttons are visual only.

**Step 2: Commit**

```bash
git add components/explore/QuickActions.vue
git commit -m "feat(explore): add quick actions sidebar component"
```

---

### Task 7: Create RoutePanel.vue

**Files:**
- Create: `components/explore/RoutePanel.vue`

**Step 1: Create the collapsible left sidebar**

Props: receive `useRouteGenerator` state via props or use the composable directly.

**State:**
- `collapsed` ref (boolean, default false)

**Template structure:**

Outer container:
- `absolute left-4 top-20 bottom-4 z-20 transition-all duration-300`
- Width: `collapsed ? 'w-3.5' : 'w-[380px]'`
- When collapsed: just a thin strip with a chevron-right icon button
- When expanded: full glassmorphic panel

Expanded panel: `bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 overflow-y-auto`

Contents (top to bottom):

1. **Header row:** flex between — div with "Route Generator" (font-bold text-lg text-gray-800) + "AI-powered itinerary" subtitle (text-xs text-gray-400) — and chevron-left button to collapse

2. **Destination input:** div with relative positioning — Icon `tabler:map-pin` absolutely positioned left, input with `pl-10 pr-4 py-3 w-full bg-white/60 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400` — v-model to destination

3. **Duration selector:** label "DURATION" (text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2) — flex row gap-2 of 5 buttons for [3, 5, 7, 10, 14]:
   - Active: `bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30`
   - Inactive: `bg-gray-100 text-gray-600 hover:bg-gray-200`
   - All: `px-3 py-2 rounded-lg text-sm font-medium transition-all`

4. **Interest tags:** label "INTERESTS" — flex wrap gap-2 of 6 chips:
   - Items: `{ emoji: '🏛', label: 'Culture' }`, `{ emoji: '🍜', label: 'Food' }`, `{ emoji: '🌿', label: 'Nature' }`, `{ emoji: '⛰️', label: 'Adventure' }`, `{ emoji: '🎨', label: 'Art' }`, `{ emoji: '🌙', label: 'Nightlife' }`
   - Active: `ring-2 ring-amber-400 bg-amber-50`
   - Inactive: `bg-gray-100 hover:bg-gray-200`
   - All: `px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all flex items-center gap-1`
   - Toggle via selectedInterests Set (add/delete)

5. **Quick stats** (v-if points.length > 0): grid grid-cols-3 gap-3 — each stat: `text-center p-2 bg-white/50 rounded-lg`
   - `~${stats.estimatedHours}h` with clock icon
   - `${stats.placeCount} places` with map-pin icon
   - `${stats.matchPercentage}%` with target icon

6. **Generate button:** `w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-400 to-orange-500 hover:shadow-lg hover:shadow-amber-500/30 transition-all`
   - Text: generating ? spinner : (points.length ? "Regenerate" : "Generate Route")
   - Disabled while generating
   - On click: call generate()

**Step 2: Commit**

```bash
git add components/explore/RoutePanel.vue
git commit -m "feat(explore): add route panel sidebar component"
```

---

### Task 8: Create RouteMarker helpers

**Files:**
- Create: `components/explore/RouteMarker.ts`

**Step 1: Create marker DOM factory and type color map**

```ts
export const TYPE_COLORS: Record<string, string> = {
  culture: '#3B82F6',
  food: '#F59E0B',
  nature: '#10B981',
  adventure: '#EF4444',
  art: '#8B5CF6',
  nightlife: '#EC4899',
}

export function createMarkerElement(index: number, delayMs: number): HTMLDivElement {
  // Create 32x32 div with inline styles:
  // - background: linear-gradient(135deg, #f87171, #f59e0b)
  // - border-radius: 50%, color: white, font-weight: bold
  // - display: flex, align-items: center, justify-content: center
  // - font-size: 14px, box-shadow, border: 2px solid white
  // - animation: markerDrop 0.5s ease-out, animation-delay: delayMs
  // - animation-fill-mode: both
  // Set textContent to (index + 1).toString()
  return el
}

export function createPopupHTML(point: RoutePoint): string {
  // Return HTML string:
  // <div style="padding:8px;min-width:150px">
  //   <div>Day {point.day} badge (small, colored)</div>
  //   <div style="font-weight:600">{point.name}</div>
  //   <div>{colored dot} {point.type}</div>
  // </div>
}
```

Also: inject a `<style>` tag with `@keyframes markerDrop` into document.head on first call (idempotent check).

**Step 2: Commit**

```bash
git add components/explore/RouteMarker.ts
git commit -m "feat(explore): add route marker DOM helpers"
```

---

### Task 9: Create pages/explore.vue — page shell

**Files:**
- Create: `pages/explore.vue`

**Step 1: Create the page composing all components**

```vue
<script lang="ts" setup>
definePageMeta({ layout: false })

const mapbox = useMapbox()
const router = useRouteGenerator()

const mapLoaded = ref(false)

function onMapLoaded() {
  mapLoaded.value = true
}

// Watch router.points — when they change, call:
// mapbox.clearMarkers()
// mapbox.addMarkers(points)
// mapbox.drawRouteLine(points)
// mapbox.fitToRoute(points)
watch(() => router.points.value, (points) => {
  if (!points.length) return
  mapbox.addMarkers(points)
  mapbox.drawRouteLine(points)
  mapbox.fitToRoute(points)
})
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden">
    <!-- Loading screen -->
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
    >
      <div class="text-6xl animate-spin">🌍</div>
      <p class="mt-4 text-white/70 text-lg">Loading map...</p>
    </div>

    <!-- Map -->
    <ExploreMapView @loaded="onMapLoaded" />

    <!-- Gradient overlays -->
    <div class="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-10" />
    <div class="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10" />

    <!-- UI Overlays -->
    <ExploreHeaderOverlay />
    <ExploreRoutePanel
      :destination="router.destination"
      :selected-days="router.selectedDays"
      :selected-interests="router.selectedInterests"
      :points="router.points"
      :generating="router.generating"
      :stats="router.stats"
      @generate="router.generate"
    />
    <ExploreQuickActions />
  </div>
</template>
```

**Step 2: Verify the page loads**

Run: `pnpm dev`
Navigate to: `http://localhost:3000/explore`
Expected: Loading screen appears, then map renders with globe projection and all overlays visible.

**Step 3: Commit**

```bash
git add pages/explore.vue
git commit -m "feat(explore): add explore page shell with all components"
```

---

### Task 10: Integration testing and polish

**Step 1: Test the full flow manually**

1. Open `/explore` — verify loading screen, then globe with fog and auto-spin
2. Type "Tokyo" in destination input, select 3 days, click Generate
3. Verify: 2s spinner, then 9 markers appear with staggered drop animation
4. Verify: dashed route line connects all points
5. Verify: camera flies to fit all markers with proper padding
6. Hover a marker — verify popup shows day, name, type
7. Type "Paris", click Regenerate — verify old markers cleared, new ones appear
8. Collapse/expand the route panel
9. Zoom out below 4 — verify globe starts spinning, stops on interaction

**Step 2: Fix any visual issues**

Common things to adjust:
- Marker z-index conflicts with popups
- Route panel scroll if content overflows
- Globe spin speed (0.01 per frame may be too fast — try 0.005)
- Fog color tuning to match reference screenshot

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(explore): polish and integration fixes"
```

---

## Task Dependency Order

```
Task 1 (install mapbox-gl)
  └→ Task 2 (useRouteGenerator) ─────────────────┐
  └→ Task 3 (useMapbox) ──→ Task 4 (MapView) ────┤
  └→ Task 5 (HeaderOverlay) ─────────────────────┤
  └→ Task 6 (QuickActions) ──────────────────────┤
  └→ Task 8 (RouteMarker helpers) ───→ Task 3    │
  └→ Task 7 (RoutePanel) ───────────────────────┤
                                                  │
                            Task 9 (page shell) ←─┘
                                  │
                            Task 10 (integration)
```

Tasks 2, 5, 6, 7, 8 can run in parallel after Task 1.
Task 3 depends on Task 8 (uses marker helpers).
Task 4 depends on Task 3.
Task 9 depends on all component tasks (2-8).
Task 10 depends on Task 9.
