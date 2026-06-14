# Explore wizard search field: full-width + animated placeholder

Two refinements to the city-search step (`currentStep === 'city'`) of
`components/explore/wizard.vue`:

1. Make the input span the full pill width (remove the empty side gaps).
2. Replace the static `placeholder="Куда едем?"` with a ChatGPT-style
   rotating placeholder that cycles through question phrases with a vertical
   slide+fade animation.

Both changes live entirely in `components/explore/wizard.vue` (template +
`<script setup>` + `<style>`). No server, composable, or schema changes.

## Goals

- Remove the wasted empty space left and right of the city input.
- Give the empty field a lively, ChatGPT-like rotating placeholder so the
  user sees varying prompts instead of one static line.
- Keep accessibility (screen reader label, reduced-motion) and existing
  wizard behavior (suggestions, keyboard nav, step morphing) intact.

## 1. Full-width input (city step only)

The outer row (`wizard.vue:290`) reserves a `w-8` (32px) slot on each side
for the **Back** / **Next** buttons. On the city step neither button shows,
so both slots render as empty `<div class="w-8 shrink-0" />` placeholders —
that is the empty space.

- Left slot (`wizard.vue:300`): the `v-else` empty `w-8` only renders on the
  city step (Back shows when `stepIndex > 0`). Drop it on the city step so
  `flex-1` expands left.
- Right slot (`wizard.vue:404`): the `v-else` empty `w-8` renders on
  city/days/generate. Render it only when `currentStep !== 'city'` so the
  city step expands right while other steps keep their slot.
- City wrapper (`wizard.vue:306`): remove `px-1`; keep input `pl-8` for the
  leading search icon, drop the right `pr-8` (the loader spinner stays at
  `right-2` only while `cityLoading`, which still has room).

Net: the input stretches nearly edge-to-edge of the pill, with only the
🔍 `tabler:map-pin-search` icon inset on the left. Other steps unchanged.

## 2. Animated placeholder (rotating question phrases)

The native `placeholder` attribute cannot be smoothly animated, so use an
overlay element on top of the input.

- **Markup**: a `<span>` positioned `absolute` over the input, aligned to the
  text start (`left-8`, matching `pl-8`), `text-sm`, color
  `var(--explore-text-faint)` (same as the current placeholder),
  `pointer-events-none`, `aria-hidden="true"`. Wrapped so overflow is
  clipped during the vertical transition.
- **Visibility**: shown only while `query` is empty. As soon as the user
  types, it disappears (parity with a native placeholder); when the field is
  cleared it resumes.
- **Native placeholder**: removed (no `placeholder` attr); add
  `aria-label="Поиск города"` to the `<input>` for screen readers.
- **Phrases** (editable single array):
  `["Куда едем?", "Город мечты?", "Куда отправимся?", "Что посмотрим?", "Какое направление?"]`
- **Rotation**: a `setInterval` (~2800ms) started in `onMounted`
  (client-only), cleared in `onBeforeUnmount` — no `@vueuse` in this repo, so
  plain timers per existing convention. Index advances modulo phrase count.
- **Transition**: phrase swap via `<Transition mode="out-in">` keyed on the
  active index — current phrase translates up + fades out, next translates up
  from below + fades in (~300ms). Dedicated transition classes in `<style>`
  (vertical), mirroring the existing `slide-left`/`slide-right` blocks.

## 3. Accessibility & edge cases

- **Reduced motion**: if `window.matchMedia("(prefers-reduced-motion: reduce)")`
  matches, disable rotation and the slide animation — show a single static
  phrase. Follows the JS pattern in `route-step-carousel.vue:161`.
- **SSR safety**: guard `matchMedia` / `setInterval` to client; start in
  `onMounted`.
- The overlay only renders on the city step, so it unmounts naturally on step
  change; the interval is cleared on unmount. (Optional: also pause rotation
  while not on the city step — cheap, can skip.)

## Files

- Edited: `components/explore/wizard.vue` (template, script, style).

## Non-goals

- No change to suggestions, keyboard navigation, step morphing, or any other
  step (days / interests / generate).
- No new component or composable; logic stays inline in the wizard.

## Testing

- `pnpm lint:source` and typecheck must pass (mandatory).
- Visual verification via preview: screenshot of the widened field; confirm
  the placeholder cycles while empty and disappears on input.
