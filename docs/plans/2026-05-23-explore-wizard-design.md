# Explore page wizard redesign

Replace the half-screen left panel on `/explore` with a compact, centered
wizard and a top-right action bar.

## Goals

- Remove the 400px-wide `ExploreRoutePanel` that dominates the map.
- Introduce a horizontal step-wizard (City → Days → Interests → Generate)
  the same height as a single input field, centered above the map.
- Show post-generation extras (weather, history, follow-up, share) as small
  icon-buttons with popovers next to the existing generation indicator.
- Keep the diary-save status visible.

## Components

### `components/explore/wizard.vue`

- Pill-shaped container, `~50px` tall, ~480px wide, absolutely positioned
  top-center over the map (`top-5 left-1/2 -translate-x-1/2 z-30`).
- Internal steps switch via Vue `<Transition name="slide">` (translateX +
  opacity, 250ms). Direction (`forward`/`back`) controls the transform sign.
- Steps:
  1. **City** — wraps existing `ExploreCityTypeahead` logic (input +
     suggestion dropdown). On selection: auto-advance.
  2. **Days** — horizontal row of day-chips (1/2/3/5/7/10/14). On select:
     auto-advance.
  3. **Interests** — horizontal scrollable chips, multi-select. Has explicit
     **Next** button (right side).
  4. **Generate** — summary + big Generate button. Disabled while
     `aiRouteSession.isGenerating`.
- Step header: small back-arrow (steps 2+), step label, progress dots.
- Mobile: `touchstart`/`touchmove`/`touchend` for swipe between steps
  (horizontal threshold ~40px). Disabled when the city dropdown is open or
  inside an input.
- After generation completes (`showRouteSession === true` and not editing):
  collapses into a small badge: `📍 Tokyo · 3 days · Culture, Food`.
  Click → expand back to wizard (resets to last step or step 1).

### `components/explore/results-actions.vue`

- Visible only when `showRouteSession` is true.
- Sits next to `AppRouteGenerationIndicator` (top-right of page, `top-20
  right-4`).
- Renders five controls:
  1. ☁ **Weather** popover — embeds `ExploreRouteWeatherTips`. Owns the
     `useRouteWeatherTips()` lifecycle moved out of the panel.
  2. 🕐 **History** popover — embeds `ExploreRouteHistory`.
  3. 💬 **Follow-up** popover — embeds `ExploreRouteFollowUp`.
  4. 📤 **Share** popover — copies `/explore?sessionId=N` to clipboard,
     uses `navigator.share` on supported devices.
  5. 📔 **Diary-save** pill — inline status `Saved 3/5`, color reflects
     status (saved=emerald, partial=amber, failed=red).
- Popovers anchored to their button, dismissed on outside click or `Esc`.

## Files

- New: `components/explore/wizard.vue`
- New: `components/explore/results-actions.vue`
- Edited: `pages/explore.vue` — remove `<ExploreRoutePanel />`, render
  `<ExploreWizard />` and `<ExploreResultsActions />`. Move the
  `selectedDay` / `selectedStoryRoutePointId` state previously shared with
  the panel out (no consumer remains).
- `components/explore/route-panel.vue` stays in repo, unused (no consumer).

## Non-goals

- Don't show story card, route-points list, distance summary,
  place-filters, context-selector, or candidate-places. Those features
  remain implemented but are not rendered on the page in this iteration.
- Don't change any server APIs, composables, or DB schema.

## Risks

- `useRouteWeatherTips` was loaded by the panel; relocating its watcher
  must keep the same trigger semantics (points, selectedDays, city).
- The wizard owns whether to show "collapsed" vs "expanded" view; the
  source of truth is route session presence, not local UI state.
