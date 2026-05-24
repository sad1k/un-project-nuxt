# Feed Composer Theming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded gray classes and rgba values in the `/feed` composer with the project's `--app-chrome-*` design tokens so the textarea placeholder is readable in dark mode and the composer surface follows the central theme.

**Architecture:** Single-file change in [pages/feed.vue](pages/feed.vue). Two `<textarea>` instances (Globe overlay + feed-list), two muted `<span>` counters, one photo-upload `<NuxtLink>`, and a `<style scoped>` block containing `.feed-composer` plus its `.dark` override. All hardcoded colors are swapped for `var(--app-chrome-*)` references that already exist in [assets/css/main.css](assets/css/main.css) and switch automatically via `html[data-theme="dark"]`.

**Tech Stack:** Nuxt 3 + Vue 3 SFCs, Tailwind CSS 4 (arbitrary-value syntax `text-[var(...)]`), DaisyUI theme switching via `data-theme` attribute on `<html>`.

**Reference:** [docs/plans/2026-05-24-feed-composer-theming-design.md](docs/plans/2026-05-24-feed-composer-theming-design.md)

---

## Pre-flight

**Step 0.1: Confirm dev environment can boot.**

Run: `pnpm install --ignore-scripts` (we skip postinstall because `nuxt prepare` requires env vars).

Expected: `Already up to date` or a clean install with no errors.

If `nuxt prepare` is needed for `.nuxt/eslint.config.mjs` later, ensure a `.env` is present with at least the keys listed in the validation output (TURSO_*, BETTER_AUTH_*, S3_*, MAPBOX_TOKEN, etc.) **before** any commit, or use `--no-verify` only after the user explicitly authorizes it.

---

## Task 1: Fix the floating composer textarea (Globe tab)

**Files:**
- Modify: [pages/feed.vue:105-110](pages/feed.vue:105)

**Step 1.1: Replace the textarea class attribute.**

Find:

```html
<textarea
  v-model="newPostContent"
  class="min-h-12 flex-1 resize-none bg-transparent text-sm text-gray-950 placeholder:text-gray-500 focus:outline-none md:min-h-24 dark:text-white dark:placeholder:text-white/45"
  maxlength="500"
  placeholder="Расскажите историю к фото..."
/>
```

Replace with:

```html
<textarea
  v-model="newPostContent"
  class="min-h-12 flex-1 resize-none bg-transparent text-sm text-[var(--app-chrome-text)] placeholder:text-[var(--app-chrome-text-muted)] focus:outline-none md:min-h-24"
  maxlength="500"
  placeholder="Расскажите историю к фото..."
/>
```

**Step 1.2: Replace the character counter span.**

Find at [pages/feed.vue:113](pages/feed.vue:113):

```html
<span class="text-xs text-gray-500 dark:text-white/45">{{ newPostContent.length }}/500</span>
```

Replace with:

```html
<span class="text-xs text-[var(--app-chrome-text-faint)]">{{ newPostContent.length }}/500</span>
```

---

## Task 2: Fix the feed-list composer textarea + photo button

**Files:**
- Modify: [pages/feed.vue:161-177](pages/feed.vue:161)

**Step 2.1: Replace the textarea class attribute.**

Find:

```html
<textarea
  v-model="newPostContent"
  class="min-h-12 flex-1 resize-none bg-transparent py-1 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none md:min-h-24 dark:text-white dark:placeholder:text-white/40"
  maxlength="500"
  placeholder="Поделитесь историей к фото..."
/>
```

Replace with:

```html
<textarea
  v-model="newPostContent"
  class="min-h-12 flex-1 resize-none bg-transparent py-1 text-sm text-[var(--app-chrome-text)] placeholder:text-[var(--app-chrome-text-muted)] focus:outline-none md:min-h-24"
  maxlength="500"
  placeholder="Поделитесь историей к фото..."
/>
```

**Step 2.2: Replace the photo upload button.**

Find at [pages/feed.vue:170-176](pages/feed.vue:170):

```html
<NuxtLink
  to="/dashboard/place-photo/new"
  class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-emerald dark:hover:bg-white/5"
  aria-label="Загрузить новое фото"
>
  <Icon name="tabler:photo" size="20" />
</NuxtLink>
```

Replace with:

```html
<NuxtLink
  to="/dashboard/place-photo/new"
  class="rounded-lg p-2 text-[var(--app-chrome-text-faint)] transition-colors hover:bg-[var(--app-chrome-control-hover)] hover:text-brand-emerald"
  aria-label="Загрузить новое фото"
>
  <Icon name="tabler:photo" size="20" />
</NuxtLink>
```

**Step 2.3: Replace the second character counter span.**

Find at [pages/feed.vue:177](pages/feed.vue:177):

```html
<span class="text-xs text-gray-500 dark:text-white/45">{{ newPostContent.length }}/500</span>
```

Replace with:

```html
<span class="text-xs text-[var(--app-chrome-text-faint)]">{{ newPostContent.length }}/500</span>
```

---

## Task 3: Collapse `.feed-composer` style block to tokens

**Files:**
- Modify: [pages/feed.vue:286-323](pages/feed.vue:286) (`<style scoped>` block)

**Step 3.1: Replace the entire `.feed-composer` + `.dark .feed-composer` + `.feed-composer--floating` + `.dark .feed-composer--floating` ruleset.**

Find:

```css
.feed-composer {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 1rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.dark .feed-composer {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(10, 10, 10, 0.58);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
}

.feed-composer--floating {
  background: rgba(255, 255, 255, 0.72);
}

.dark .feed-composer--floating {
  background: rgba(5, 5, 5, 0.54);
}
```

Replace with:

```css
.feed-composer {
  border: 1px solid var(--app-chrome-border);
  border-radius: 1.25rem;
  background: var(--app-chrome-bg);
  padding: 1rem;
  box-shadow: 0 20px 60px var(--app-chrome-shadow);
  backdrop-filter: blur(18px);
}

.feed-composer--floating {
  background: var(--app-chrome-control-bg);
}
```

Why the `.dark` blocks disappear: the project switches themes via `html[data-theme="dark"]` (see [assets/css/main.css:85](assets/css/main.css:85)), which rebinds every `--app-chrome-*` token. Tailwind's `.dark` class is **not** used to drive these tokens, so the manual `.dark .feed-composer` overrides were duplicating work.

---

## Task 4: Verify in browser

**Step 4.1: Boot the dev server.**

Run: `pnpm dev`

Expected: Nuxt prints a local URL (usually `http://localhost:3000`). If `nuxt prepare` complains about missing env vars, source `.env` first.

**Step 4.2: Open `/feed` and toggle theme.**

In a browser:
1. Navigate to `/feed`.
2. Confirm: in the default theme, placeholder "Поделитесь историей к фото..." is visible against the soft-white composer card.
3. Click the sun/moon toggle in the top-right header.
4. Confirm: in dark theme, the same placeholder is **clearly readable** (no longer ghost-white-on-near-black like the report screenshot).
5. Type a few characters → typed text uses chrome-text color and is sharp in both themes.
6. The `N/500` counter is muted but legible in both themes.

**Step 4.3: Open `/feed?tab=globe` and toggle theme.**

1. Switch to the Globe tab.
2. Confirm the floating composer at the bottom shows the same legibility in both themes.
3. The floating composer's surface should be slightly more translucent than the feed-list version (intentional — `--app-chrome-control-bg` vs `--app-chrome-bg`). If it looks **too transparent** over the busy globe background, note it for the risk-mitigation in the design doc (swap to `var(--app-chrome-bg)` for `--floating`).

**Step 4.4: Visual regression sanity-check on rest of `/feed`.**

Scroll the feed list. The post cards, author-filter chip, "Ваша лента" heading, loading spinner copy, and empty-state should look identical to before — none of those were touched.

---

## Task 5: Commit

**Step 5.1: Ensure `.env` is present so `pnpm lint` can run via the pre-commit hook.**

Run: `pnpm lint -- pages/feed.vue`

Expected: PASS with no errors.

If `.nuxt/eslint.config.mjs` is missing, run `pnpm nuxi prepare` (requires env vars) first.

**Step 5.2: Stage and commit.**

```bash
git add pages/feed.vue docs/plans/2026-05-24-feed-composer-theming-design.md docs/plans/2026-05-24-feed-composer-theming.md
git commit -m "$(cat <<'EOF'
fix(feed): use --app-chrome-* tokens for composer + textarea placeholder

The /feed composer hardcoded rgba() surfaces and gray text classes, which
made the dark-mode textarea placeholder unreadable (white/40 over near-
black glass). Switch to the existing --app-chrome-* tokens so theme
swapping happens via html[data-theme="dark"] without duplicate .dark
overrides.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit lands cleanly; pre-commit hook's `lint-staged` runs ESLint on the staged Vue file and passes.

If `pnpm lint` fails for unrelated reasons (existing errors in repo), surface the output to the user before considering `--no-verify` (which requires explicit user approval per project rules).

---

## Out of Scope (do not touch in this plan)

- Root background/text on [pages/feed.vue:71](pages/feed.vue:71) (`bg-gray-50 text-gray-950 ... dark:bg-[#050505] dark:text-white`) — works in both themes, separate cleanup.
- Author-filter chip styling [pages/feed.vue:189-201](pages/feed.vue:189) — uses `text-gray-900 dark:text-white`, working.
- Empty-state / loading / error copy [pages/feed.vue:209-260](pages/feed.vue:209) — uses `text-gray-400` without dark variant; readable in both themes today.
- "Вы просмотрели все публикации" line [pages/feed.vue:275](pages/feed.vue:275).
- `components/explore/*` — already token-driven, audited as clean.

These could be a follow-up sweep titled "Unify pages/feed.vue under app-chrome tokens" but are not part of this bug fix.
