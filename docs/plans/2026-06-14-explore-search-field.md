# Explore Search Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the `/explore` city-search input span the full pill width and replace its static placeholder with a ChatGPT-style rotating set of question phrases.

**Architecture:** All changes live in one file, `components/explore/wizard.vue` (the `currentStep === 'city'` block). Width is reclaimed by not reserving the empty `w-8` Back/Next button slots on the city step. The animated placeholder is an `aria-hidden` overlay `<span>` on top of the input (the native `placeholder` attribute cannot be animated); it cycles a phrase array via `setInterval` + a Vue `<Transition>` (vertical slide+fade), pauses for `prefers-reduced-motion`, and hides while the field has text.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup lang="ts">`, Tailwind utility classes, Tabler icons. Tests are static-source assertions run with Node's built-in test runner (the repo's convention — no DOM/component runner, no `@vueuse`).

**Design doc:** `docs/plans/2026-06-14-explore-search-field-design.md`

---

## Conventions in this repo (read before starting)

- **"UI tests" are static source assertions**: a `.test.mjs` file `readFile`s a component and `assert.match`es regexes against its source text (see `tests/server/route-diary-ui.test.mjs`). That is the TDD vehicle here.
- **No `@vueuse`** — use plain `setInterval`/`clearInterval` + `onMounted`/`onBeforeUnmount` (auto-imported by Nuxt). `prefers-reduced-motion` is checked via `window.matchMedia` (pattern in `components/explore/route-step-carousel.vue:161`).
- **Lint is mandatory** before committing: `pnpm lint:source`. Also run `pnpm typecheck`.
- **Run a single test file:** `node scripts/run-node-tests.mjs tests/server/explore-wizard-search-field.test.mjs`
- **Commit style:** Conventional Commits (`feat(explore): ...`). No AI co-author trailer, no "Generated with" footer.

---

## Task 1: Failing test for both changes

**Files:**
- Create: `tests/server/explore-wizard-search-field.test.mjs`

**Step 1: Write the failing test**

```js
/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const wizardSource = await readFile("components/explore/wizard.vue", "utf8");

test("city search input is widened by dropping the empty side slots", () => {
  // Empty w-8 spacer slots are no longer reserved on the city step.
  assert.match(wizardSource, /currentStep !== 'city'/);
  // City input wrapper drops the extra px-1 inset (ends right after items-center).
  assert.match(wizardSource, /relative flex w-full items-center"/);
});

test("city search uses an animated rotating placeholder", () => {
  assert.match(wizardSource, /PLACEHOLDER_PHRASES/);
  assert.match(wizardSource, /Куда едем\?/);
  assert.match(wizardSource, /Город мечты\?/);
  assert.match(wizardSource, /name="placeholder-roll"/);
  assert.match(wizardSource, /explore-wizard-placeholder/);
  // Native placeholder attribute removed in favor of the overlay + a11y label.
  assert.doesNotMatch(wizardSource, /placeholder="Куда едем\?"/);
  assert.match(wizardSource, /aria-label="Поиск города"/);
});

test("placeholder rotation is cleaned up and respects reduced motion", () => {
  assert.match(wizardSource, /setInterval/);
  assert.match(wizardSource, /clearInterval/);
  assert.match(wizardSource, /prefers-reduced-motion: reduce/);
});
```

**Step 2: Run the test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/explore-wizard-search-field.test.mjs`
Expected: FAIL — current source has `currentStep === 'city'` (not `!==`), the wrapper still ends in `px-1"`, there is no `PLACEHOLDER_PHRASES`, and `placeholder="Куда едем?"` is still present.

---

## Task 2: Widen the city input (template)

**Files:**
- Modify: `components/explore/wizard.vue` (the outer row + city block, ~`290-330`, `395-404`)

**Step 1: Drop the empty LEFT slot on the city step**

Find (`wizard.vue:300`):

```vue
          <div v-else class="w-8 shrink-0" />
```

This is the `v-else` to the Back button (`v-if="stepIndex > 0"`). Replace with a version that does **not** reserve space on the city step:

```vue
          <div v-else-if="currentStep !== 'city'" class="w-8 shrink-0" />
```

**Step 2: Drop the empty RIGHT slot on the city step**

Find (`wizard.vue:404`):

```vue
          <div v-else class="w-8 shrink-0" />
```

This is the `v-else` to the Next button (`v-if="currentStep === 'interests'"`). Replace with:

```vue
          <div v-else-if="currentStep !== 'city'" class="w-8 shrink-0" />
```

**Step 3: Remove the wrapper `px-1` and the input's right padding**

Find the city wrapper open tag (`wizard.vue:306`):

```vue
                <div v-if="currentStep === 'city'" class="relative flex w-full items-center px-1">
```

Replace with (drop `px-1`):

```vue
                <div v-if="currentStep === 'city'" class="relative flex w-full items-center">
```

Find the input's class (`wizard.vue:317`) and change `px-8` to `pl-8 pr-9` (keep left room for the search icon; keep a small right inset so the loading spinner at `right-2` never overlaps typed text):

```vue
                    class="explore-wizard-input w-full rounded-full bg-transparent pl-8 pr-9 py-2 text-sm outline-none"
```

> Note: this is a minor refinement over the design doc, which said "drop the right padding". A small `pr-9` is kept on purpose so the `cityLoading` spinner doesn't collide with long text. The big win (≈64px of empty `w-8` slots) is still reclaimed.

**Step 4: Re-run the test**

Run: `node scripts/run-node-tests.mjs tests/server/explore-wizard-search-field.test.mjs`
Expected: the first test ("widened") now PASSES; the placeholder tests still FAIL.

---

## Task 3: Animated rotating placeholder

**Files:**
- Modify: `components/explore/wizard.vue` (`<script setup>`, city block template, `<style>`)

**Step 1: Add rotation state + lifecycle in `<script setup>`**

Add after the city-typeahead block (after the existing `onBeforeUnmount` near `wizard.vue:114`), or anywhere in `<script setup>` top level:

```ts
// Animated placeholder (rotating questions, ChatGPT-style)
const PLACEHOLDER_PHRASES = [
  "Куда едем?",
  "Город мечты?",
  "Куда отправимся?",
  "Что посмотрим?",
  "Какое направление?",
];
const placeholderIndex = ref(0);
const showAnimatedPlaceholder = computed(() => query.value.trim().length === 0);

let placeholderTimer: ReturnType<typeof setInterval> | undefined;

function startPlaceholderRotation() {
  if (placeholderTimer)
    return;
  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion)
    return; // keep a single static phrase
  placeholderTimer = setInterval(() => {
    placeholderIndex.value = (placeholderIndex.value + 1) % PLACEHOLDER_PHRASES.length;
  }, 2800);
}

function stopPlaceholderRotation() {
  if (placeholderTimer) {
    clearInterval(placeholderTimer);
    placeholderTimer = undefined;
  }
}

onMounted(() => {
  startPlaceholderRotation();
});
```

**Step 2: Stop the timer on unmount**

The component already has an `onBeforeUnmount` (`wizard.vue:111`) that clears `debounceTimer`. Add the placeholder cleanup inside it:

```ts
onBeforeUnmount(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer);
  stopPlaceholderRotation();
});
```

**Step 3: Rework the city input markup (overlay + a11y, no native placeholder)**

Replace the whole city `<input>` + add the overlay. The block becomes:

```vue
                <!-- City -->
                <div v-if="currentStep === 'city'" class="relative flex w-full items-center">
                  <Icon
                    class="explore-text-faint absolute left-2 z-10"
                    name="tabler:map-pin-search"
                    size="16"
                  />
                  <input
                    v-model="query"
                    aria-autocomplete="list"
                    aria-label="Поиск города"
                    :aria-expanded="dropdownOpen"
                    autocomplete="off"
                    class="explore-wizard-input w-full rounded-full bg-transparent pl-8 pr-9 py-2 text-sm outline-none"
                    type="search"
                    @keydown.down.prevent="moveActiveSuggestion(1)"
                    @keydown.up.prevent="moveActiveSuggestion(-1)"
                    @keydown.enter.prevent="selectActiveSuggestion"
                  >
                  <div
                    v-if="showAnimatedPlaceholder"
                    aria-hidden="true"
                    class="explore-wizard-placeholder pointer-events-none absolute inset-y-0 left-8 right-9 flex items-center overflow-hidden"
                  >
                    <Transition name="placeholder-roll" mode="out-in">
                      <span :key="placeholderIndex" class="block truncate">
                        {{ PLACEHOLDER_PHRASES[placeholderIndex] }}
                      </span>
                    </Transition>
                  </div>
                  <Icon
                    v-if="cityLoading"
                    class="explore-text-faint absolute right-2 animate-spin"
                    name="tabler:loader-2"
                    size="16"
                  />
                </div>
```

Key diffs from the original: removed `placeholder="Куда едем?"`, added `aria-label="Поиск города"`, changed `px-8`→`pl-8 pr-9`, added `z-10` to the leading icon so it stays above the overlay, and inserted the `explore-wizard-placeholder` overlay.

**Step 4: Add the overlay styles + transition in `<style>`**

Add near the existing `.explore-wizard-input::placeholder` rule (`wizard.vue:495`) and the slide transition block (`wizard.vue:514`):

```css
.explore-wizard-placeholder {
  color: var(--explore-text-faint);
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.placeholder-roll-enter-active,
.placeholder-roll-leave-active {
  transition:
    transform 300ms ease,
    opacity 300ms ease;
}
.placeholder-roll-enter-from {
  transform: translateY(70%);
  opacity: 0;
}
.placeholder-roll-leave-to {
  transform: translateY(-70%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .placeholder-roll-enter-active,
  .placeholder-roll-leave-active {
    transition: none;
  }
}
```

**Step 5: Run the test to verify all pass**

Run: `node scripts/run-node-tests.mjs tests/server/explore-wizard-search-field.test.mjs`
Expected: all three tests PASS.

---

## Task 4: Lint and typecheck

**Step 1: Lint**

Run: `pnpm lint:source`
Expected: no errors. (If the new test file trips a rule, mirror the exact header/style of `tests/server/route-diary-ui.test.mjs`.)

**Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors in `components/explore/wizard.vue`.

---

## Task 5: Commit

**Step 1: Stage and commit only the touched files**

```bash
git add components/explore/wizard.vue tests/server/explore-wizard-search-field.test.mjs
git commit -m "feat(explore): full-width city search with animated placeholder"
```

(Do not stage the unrelated working-tree changes already present in the repo.)

---

## Task 6: Visual verification (preview)

This change is presentational, so confirm it in the browser preview (do not ask the user to check manually).

**Step 1:** Ensure the dev server is running (`preview_start` if needed) and open `/explore`.

**Step 2:** `preview_console_logs` — confirm no errors/hydration warnings.

**Step 3:** `preview_screenshot` of the wizard pill — confirm the input now spans nearly the full width (no large empty gaps left/right, search icon still at left).

**Step 4:** Wait ~3s and `preview_screenshot` again — confirm the placeholder text changed (rotation working). Optionally `preview_snapshot` to read the overlay span text across two samples.

**Step 5:** `preview_fill` the input with text, then `preview_snapshot` — confirm the animated overlay disappears while typing.

**Step 6:** Share the before/after screenshots as proof.

---

## Notes / risks

- **Hydration safety:** `placeholderIndex` starts at `0` on both server and client, and the timer/`matchMedia` only run inside `onMounted` (client). No mismatch expected.
- **Other steps unchanged:** the slot gating uses `currentStep !== 'city'`, so days/interests/generate keep their Back/Next button spacing.
- **Reduced motion:** when `prefers-reduced-motion: reduce`, rotation never starts (static first phrase) and the CSS transition is disabled — double coverage.
- **Phrases** are a single editable array; adjust freely if the user wants a different set.
