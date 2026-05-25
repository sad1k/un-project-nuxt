# Mobile Route Step Carousel — Design

**Date:** 2026-05-24
**Scope:** mobile-only (`max-md`) `/explore` page
**Problem:** After AI route generation, mobile users can't see the order of stops or where the route starts. Numbered markers exist on the map, but the ordered list is hidden inside a desktop-only side panel.

## Goal

Give mobile users a step-by-step way to walk through a generated route — see the current step, jump to neighbours, follow the camera, without sacrificing map real estate.

## Primary user task

Walking through the route in the field, step-by-step. "Current step" is a first-class concept (not a passive list, not an editor).

## Solution at a glance

A **swipeable card carousel** anchored to the bottom of the map. Each card = one route stop. Swiping changes the active stop; the map camera flies to its marker. The wizard "city/days/interests" badge relocates from the bottom into the top context row as a small chip.

```
┌──────────────────────────────────────┐
│ 🔍 Search                  ☀️ 👤     │  row 1: search
│ [📍 Paris · 5 дн · Культура ✎]       │  row 2: wizard-chip ⨁ results-actions
│                  [0/13][☁][🕐][💬][↗]│
│                                      │
│         MAP (claims +88px)           │
│                                      │
│ ─── handle ─── [Все│Д1│Д2…]  •○○○○   │  carousel header (~32px)
│ ┌─┐ ② Лувр   90мин · 1.2км       ▷  │  ← active card (~110px)
│ └─┘ [💾] [🗺]                         │
│ 🗺  📰  ➕  📸  👤                    │  mobile-toolbar (unchanged)
└──────────────────────────────────────┘
```

## Components

### New: `components/explore/route-step-carousel.vue`

Mobile-only (`md:hidden`). Mounts in `pages/explore.vue` alongside `<ExplorePlaceBottomSheet />`. Renders only when `aiRouteSession.activePoints.length > 0 || aiRouteSession.isGenerating`.

### Modified: `components/explore/wizard.vue`

Collapsed badge moves to top context row on mobile when `showRouteSession && !editing`. Expanded (editing) state still renders bottom-anchored as today. On mobile chip text is shortened: `[📍 Paris · 5 дн · Культура ✎]` (city + days + first interest + edit). Category truncates first on narrow screens.

### Modified: `pages/explore.vue`

- Mount the carousel.
- Add a watcher `selectedStoryRoutePointId → mapbox.flyTo(point, zoom 15, 600ms)`.
- Track an `isCarouselDriven` flag to prevent the existing `fitToRoute` watcher from fighting the swipe-induced camera moves.

### Unchanged

- `components/explore/route-panel.vue` (desktop) — keeps its current vertical list.
- `components/explore/place-bottom-sheet.vue` — reused for "tap card → full details".
- `composables/use-ai-route-session.ts`, `lib/explore/route-map.ts` — no API changes.

## Data sources (all pre-existing)

| State | Origin | Role |
|---|---|---|
| `aiRouteSession.activePoints` | `useAiRouteSession` | source of points |
| `aiRouteSession.isGenerating` | same | drives skeleton |
| `aiRouteSession.error` / `lastWarning` | same | error / warning states |
| `selectedDay` | `useState("explore-selected-route-day")` | day filter (shared with route-panel and explore.vue) |
| `selectedStoryRoutePointId` | `useState("explore-selected-story-route-point-id")` | **active step** — single source of truth, already shared by story-card + popup + marker click |
| `routeMapPoints` / `selectedRoutePoints` | derived via `toRouteMapPoints` + `filterRoutePointsByDay` | card list |

Active carousel index = `selectedStoryRoutePointId`. No new state channel.

## Card content

```
┌──────────────────────────────────────────────────┐
│ ┌────┐  ②  Лувр                          ┌────┐ │
│ │ 🖼 │     ⏱ 90 мин  ·  📍 1.2 км до сл.  │ ▷  │ │
│ │    │     🍴 Еда · Культура              └────┘ │
│ └────┘                                            │
│  [💾 Сохранить]   [🗺 К месту]                    │
└──────────────────────────────────────────────────┘
```

| Zone | Content | Source |
|---|---|---|
| Thumb 64×64 | Hero image | `placeIntelligence.loadForRoutePoint` (lazy, preload active ± 2 neighbours) |
| Number badge | Index in `selectedRoutePoints`. Last = `brand-sangria`. | derived |
| Title | Place name, single line, truncate | `point.name` |
| Meta | Duration + distance to next leg | `estimatedDurationMinutes`, `selectedRouteLegs[i]` |
| Tags | Up to 2 interest tags | `intelligence.tags` |
| Actions | Save to diary, Directions | `saveRoutePointToDiary`, `openDirectionsToNextStop` |
| ▷ | Open details | opens `place-bottom-sheet` |

## Header chrome

- **Drag-handle** on top (visual parity with `place-bottom-sheet`). Tap collapses the carousel into a floating mini-pill `Шаг 2/13 ▲` near the mobile toolbar. Tap again restores.
- **Day-chips** — horizontal scrollable `Все / Д1 / Д2 / …`. Hidden when route is single-day. Binds to `selectedDay`.
- **Progress line** — `«День 1 · Шаг 2 из 13»` + dot indicator.

## Swipe ↔ active step ↔ map camera

Native CSS scroll-snap, no JS dragging:

```css
.cards-track  { display: flex; overflow-x: auto;
                scroll-snap-type: x mandatory; scroll-behavior: smooth; }
.step-card    { scroll-snap-align: center; flex: 0 0 84%; }
```

Active card detected via `IntersectionObserver` on the track (`threshold: 0.6`). On intersect → set `selectedStoryRoutePointId`.

Flow:

```
[user swipes carousel]
        ↓
IntersectionObserver
        ↓
selectedStoryRoutePointId = point.sourceId  ← shared useState
        ↓
   ┌────┴────┬─────────────┬──────────────┐
   ↓         ↓             ↓              ↓
self     mapbox.flyTo   popup        story-card
(scroll) (new watcher)  (sync)       (sync)
```

The same `useState` drives marker-click → carousel reverse-scrolls via `scrollIntoView({behavior:'smooth', inline:'center'})`.

Camera: `mapbox.flyTo({ center: [lng,lat], zoom: 15, duration: 600 })`. Does NOT call `fitToRoute` — that would destroy walking context. `fitToRoute` stays bound to `activeVariantId` / `selectedDay` changes only.

To prevent the existing fit-to-route watcher from snapping back, swipe-initiated camera moves set `isCarouselDriven = true` while the flyTo is in flight; the fit-scope watcher skips when set.

## Day filter

- Tap "Все" → `selectedDay = null` → carousel shows all points.
- Tap "День N" → `selectedDay = N` → carousel shrinks to that day; active resets to first point of that day.
- If the active point belongs to a day not in the current filter (e.g. coming back from another component setting it), auto-switch the filter to that day (extends existing watcher in `route-panel.vue` line 100-108).

## Tap vs swipe disambiguation

- Tap on card (not on a button) → opens `place-bottom-sheet` via `openPlaceSheet(point)`.
- Tap on action buttons (`Save`, `Directions`) → `.stop` on each, runs the per-button handler.
- Swipe → native horizontal scroll-snap, browser swallows the tap automatically.

No custom touchmove logic needed.

## States

1. **Hidden** — `activePoints.length === 0 && !isGenerating` → not rendered. Wizard stays in its current bottom position.
2. **Generating** — `isGenerating`. 3 skeleton cards with shimmer. Header reads "Генерируем маршрут…". Day-chips hidden.
3. **Ready** — standard.
4. **Error** — `aiRouteSession.error !== null`. Track replaced with one error card + retry CTA. Styling matches `explore-status-danger`.
5. **Warning** — `lastWarning !== null` AND points exist. Thin dismissible warning stripe above the header, single line.
6. **Collapsed** — user dragged the handle down. Carousel becomes a floating pill `Шаг 2/13 ▲`. Tap restores.

## Edge cases

- Single day, single point → carousel locks to single-card mode, no swipe, no day-chips.
- Active point removed on regenerate → watcher resets to first point; carousel scrolls to start.
- Marker tap from another day → existing day-switch watcher fires; carousel re-renders + scrolls to that card.
- Streaming generation (LLM still pushing points) → cards appear as they arrive; the user's current selection is not overridden by incoming points.
- iPhone SE 320px → wizard chip truncates first the interest category, falling back to `[📍 Paris ✎]` if still tight.

## Top row budget (mobile, 375px)

| Element | Width |
|---|---|
| wizard-chip (with truncate) | ~110px |
| diary-pill | ~50px |
| 4 round action buttons + gaps | ~144px |
| paddings + inter-gaps | ~24px |
| **Total** | **~328 / 351px** ✓ |

At 320px the chip shortens to `[📍 Paris ✎]` (~70px) so the row still fits.

## Open / deferred

- **`«Маршрут Almaty завис»` warning** seen in the screenshot is a stale `aiRouteSession.lastWarning` from a previous session. Recommended follow-up: render that warning as the carousel's warning-stripe (state #5 above), not as a separate top-row chip. Out of scope for this design.
- **Geolocation auto-advance** (advance step when user physically arrives near a stop) — explicit non-goal here; can be added later as an opt-in toggle.
- **Reordering / removing stops from the carousel** — explicit non-goal; carousel is a navigator, not an editor.

## Testing approach

- Component test for `route-step-carousel.vue`: renders skeleton when generating, renders N cards when active points present, emits `setActive` on IntersectionObserver fire.
- Integration test in `pages/explore.vue`: swiping the carousel updates `selectedStoryRoutePointId` and triggers `mapbox.flyTo`. Marker click reverse-scrolls the carousel.
- Visual: snapshot at 320 / 375 / 414 widths to confirm chip truncation.
- Manual: regen mid-walk doesn't lose user's currently-viewed step.

## Non-goals

- Desktop `route-panel.vue` untouched.
- No changes to AI generation API.
- No new global state.
- No drag-to-reorder.
