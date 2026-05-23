# Mobile Dashboard Redesign — Design

**Date:** 2026-05-23
**Scope:** WanderLog dashboard surface (`pages/dashboard/*`, `components/location-card.vue`, `components/location-base-form.vue`, `components/app/mobile-toolbar.vue`, `layouts/default.vue`)
**Out of scope:** `/feed`, `/explore`, `/sign-in`, brand tokens, icon library, new colors.

## Problem

The dashboard was built desktop-first. On mobile:

- `pages/dashboard.vue` forces split-view: `<NuxtPage>` next to `<AppYndxMap>` always, both fighting for the same width.
- `.location-list` is `flex flex-nowrap overflow-auto` with `LocationCard` at `w-full sm:w-[280px]`. On a phone each card is a full screen; users must horizontally scroll to discover the next saved place.
- `LocationCard` selects the map point via `@mouseenter` and styles via `hover:*` utilities — both inert on touch devices.
- The bottom toolbar uses `text-[10px]` labels and `py-1.5` height (~32pt touch target, below the 44pt minimum) and lacks a primary "add" affordance.
- Forms (`location-base-form.vue`) place a right-aligned submit + cancel of equal weight; on narrow viewports they wrap awkwardly and the primary action is not full-width.
- The location detail page (`pages/dashboard/location/[slug].vue`) puts a dropdown inside `<h1>` and uses imperative `dialog.showModal()` calls.

## Approach (chosen: A — Content-first with Map Sheet)

Mobile dashboard becomes content-first. The map is reachable through a bottom sheet with three snap points (`collapsed` / `peek` / `expanded`) rather than always-on split. Desktop layout is unchanged.

Rejected alternatives:

- **B — Tabs (List / Map):** Loses simultaneous context. Map is core to WanderLog's value; tabs hide it on every switch.
- **C — Minimal CSS fix:** Just hide map on `md:hidden` and re-grid the list. Cheapest but removes the map entirely from the mobile dashboard, which is a regression for a travel-journaling product.

## Design

### 1. Layout architecture

```
NuxtLayout (default.vue)
  AppNavBar (existing, sticky top)
  main
    NuxtPage (always full-width on mobile)
  MapBottomSheet (mobile-only overlay; sticky bottom)
    states: collapsed (64pt handle) | peek (60svh) | expanded (100svh)
    lazy mount AppYndxMap on first peek/expanded
  AppMobileToolbar (existing slot, redesigned)
```

`pages/dashboard.vue` no longer renders `AppYndxMap` inline on mobile. On `md+` the current split layout stays.

Sheet rules:

- Handle bar shows live counter: `📍 N мест на карте`.
- Drag/swipe-up between snap points; tap on handle toggles `collapsed ↔ peek`.
- On `collapsed`, `AppYndxMap` is unmounted (no tile fetches, no memory).
- Edit screens (`add.vue`, `edit.vue`): sheet defaults to `peek` so the user sees the marker while dragging.
- Detail screen (`[slug].vue`): on `peek` the map auto-centers on the current location.

### 2. LocationCard (mobile variant)

Horizontal layout, single tap target:

```
┌────────────────────────────────────────────┐
│ [thumb 72×72]  Title (line-clamp-1)    ›  │
│                Description (line-clamp-2)  │
│                📍 5.2 км · 3 фото          │
└────────────────────────────────────────────┘
```

- The whole row is the link to detail; chevron indicates tap affordance.
- Trailing icon button `tabler:map-pin` calls `mapStore.flyToPoint = mapPoint` and lifts the sheet to `peek`. This is the only "show on map" interaction — no hover magic.
- Press feedback: `active:scale-[0.98] active:bg-*`. All `hover:*` utilities and `@mouseenter`/`@mouseleave` are removed.
- Selected state: `border-l-4 border-brand-gold` (no `ring` that shifts layout).
- Thumbnail: first image from `location.locationLogs[0].images[0]` via responsive `<img srcset>`; fallback is a `tabler:map-pin` glyph on the brand gradient.
- List wrapper changes from `flex flex-nowrap overflow-auto` to `flex flex-col gap-2` on mobile, `md:grid md:grid-cols-2 lg:grid-cols-3` above.
- Empty state stays as-is but stacks vertically with full-width CTAs on mobile.

### 3. Bottom toolbar + primary CTA

Replace the 4-equal-slot floating bar with a 5-slot full-width bar and a central FAB:

```
┌─────────────────────────────────────────────┐
│  🗺      🌐      ⊕      📷      👤          │
│ Карта  Лента   Место  Фото   Я            │
└─────────────────────────────────────────────┘
```

- FAB opens an action sheet with three options: "Добавить место" / "Быстрое фото" / "Опубликовать пост" — consolidating today's separate primary affordances.
- Each slot ≥56pt high, icons 24pt, labels `text-[11px] font-medium`.
- Active state: color-only + dot indicator below the label (no background fill, which competes with the FAB).
- Bar becomes full-width `inset-x-0 bottom-0 rounded-t-2xl` instead of floating with side margins (gives +24px per slot and stable position).
- Safe-area padding (`env(safe-area-inset-bottom)`) is preserved.
- Naming is unified across side-rail and toolbar: Карта / Лента / Место / Фото / Я.

### 4. Detail page + forms

Detail (`[slug].vue`):

- Sticky header `h-12`: back chevron (`router.back()`), centered truncated title, `⋮` menu (Удалить / Редактировать).
- `<h1>` holds the location name only; dropdown is moved out.
- Inline "📍 Показать на карте" button replaces the hover-sync behavior.
- Delete confirmation: Vue-managed `<dialog ref>` (no imperative `dialog.showModal()`); on mobile, a slide-up action sheet.
- Visit logs render with the new horizontal LocationCard using the `#top` slot for the date chip.
- Empty visit state: full-width "+ Добавить первое посещение" right under the title.

Form (`location-base-form.vue` + `add.vue` + `edit.vue`):

- Labels above inputs; `gap-4` between fields.
- Inputs `min-h-[44px]` and `text-base` (≥16px to defeat iOS auto-zoom).
- Helper text becomes a short `<p class="text-xs">` under the coordinates field instead of an info card between fields and submit.
- Sticky bottom action bar on mobile:
  - Primary `Сохранить`: full-width, brand-emerald, inline spinner, disabled until valid.
  - Secondary `Отмена`: text link under primary (not a sibling button), `router.back()`.
  - Desktop keeps the current inline actions.
- `add.vue` drops `max-w-2xl` on mobile (uses full width with `px-4`); `lg:max-w-2xl` stays.
- Unsaved-changes guard: replace `window.confirm` with an in-app modal (existing `<dialog>` pattern).
- Validation: error messages under the field with `aria-invalid="true"`, focus first invalid field after submit.

### 5. Spacing, theming, hover→touch

Mobile spacing scale (4pt rhythm):

| Context | Value |
|---|---|
| Page horizontal padding | `px-4` (drop `sm:px-6 lg:px-8` inconsistency) |
| Section gap | `gap-6` |
| Inline list gap | `gap-2` |
| Card padding | `p-3` |
| Touch target min | `min-h-[44px]` |
| Sticky header | `h-12` |
| Bottom toolbar | `h-16` + safe-area |

Container width: `add.vue` becomes `w-full px-4` on mobile, `lg:max-w-2xl` on desktop.

Theming reuses existing tokens — no new CSS variables. FAB and sheet handles use `--app-chrome-bg` / `--app-chrome-border` / `--app-active-accent`. FAB fill is the existing `bg-brand-emerald` with `shadow-lg shadow-brand-emerald/30`.

Hover → touch sweep (rule `hover-vs-tap`):

- `LocationCard`: remove `hover:-translate-y-1`, `hover:border-brand-gold`, `@mouseenter`, `@mouseleave`. Add `active:scale-[0.98] active:bg-*`.
- `mobile-toolbar`: remove `group-hover:-translate-y-0.5 group-hover:scale-110`. Add `active:scale-95`.
- `side-rail` stays untouched (md+ only).

### 6. Accessibility

- All touch targets ≥44pt.
- Visible form labels (not placeholder-only).
- Errors near field + `aria-invalid` + focus-on-first-error.
- `aria-label` on icon-only controls: FAB, back, ⋮ menu, "show on map".
- Sheet/FAB animations wrapped in `motion-safe:` (respects `prefers-reduced-motion`).
- Body text ≥16px on inputs prevents iOS auto-zoom.
- Color contrast: brand tokens already pass 4.5:1; FAB white-on-emerald passes.

### 7. Pre-delivery checklist

- [ ] 375×667 (iPhone SE), 390×844 (iPhone 12), 412×915 (Pixel 5) verified.
- [ ] Landscape orientation: sheet does not block content.
- [ ] Dark mode verified independently (not inferred from light).
- [ ] `prefers-reduced-motion`: sheet/FAB snap instantly.
- [ ] Browser zoom 200% / Dynamic Type largest: no layout break.
- [ ] Safe-area: notch top, gesture bar bottom clear of header/toolbar.
- [ ] Keyboard: tab order intact, Escape closes sheet / modal / dialog.
- [ ] PWA install prompt + offline status do not overlap the new toolbar.

## Files affected

- `pages/dashboard.vue` — responsive split, mount sheet instead of inline map on mobile.
- `pages/dashboard/index.vue` — vertical list, drop horizontal scroll, page header tweaks.
- `pages/dashboard/add.vue` — drop `max-w-2xl` on mobile, h1 outside form.
- `pages/dashboard/location/[slug].vue` — sticky header, dropdown out of h1, Vue-managed dialog.
- `pages/dashboard/location/[slug]/add.vue`, `.../edit.vue` — sticky action bar, error-near-field, focus-management.
- `components/location-card.vue` — horizontal layout, drop hover-only, explicit map button.
- `components/location-base-form.vue` — label-above-input, sticky mobile action bar, helper-text not info-card.
- `components/app/mobile-toolbar.vue` — 5 slots with central FAB, full-width, 44pt+ targets.
- `components/app/map-bottom-sheet.vue` — NEW. Three-snap sheet wrapping `AppYndxMap` lazily.
- `components/app/action-sheet.vue` — NEW (or extracted). Shared sheet primitive for FAB menu and unified delete confirm on mobile.
- `layouts/default.vue` — adjusted `pb-*` so content does not slip under the new toolbar; mounts `MapBottomSheet` on mobile dashboard routes only.

## Testing

- Component tests: `LocationCard` press feedback, "show on map" click dispatches `mapStore.flyToPoint`, no longer reacts to mouseenter.
- Component tests: `MapBottomSheet` snap transitions, lazy-mount `AppYndxMap` only after first `peek`.
- Component tests: `AppMobileToolbar` FAB action sheet items present and route correctly; active state per route.
- Form tests: invalid submit focuses first errored field; primary button disables while loading.
- Manual smoke: pre-delivery checklist above.

## Risks

- `AppYndxMap` may not tolerate being unmounted/remounted cleanly — needs verification of map provider lifecycle (token, GL context, listeners).
- Sticky bottom action bar in forms can collide with the mobile toolbar — coordinate via `z-index` scale (toolbar 50, sticky form bar 40, sheet 60).
- Drag gestures on sheet must not capture vertical scroll inside the page below — needs touch-action discipline.
