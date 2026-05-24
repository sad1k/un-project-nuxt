# Feed composer theming fix

## Problem

On `/feed`, the post composer in [pages/feed.vue](../../pages/feed.vue) has two visible defects in dark mode:

1. **Invisible textarea placeholder.** The placeholder uses `dark:placeholder:text-white/40`
   over a composer surface of `rgba(10, 10, 10, 0.58)`. The resulting contrast is
   below readable threshold.
2. **Theming inconsistency.** The composer hardcodes its own `rgba(...)` background,
   border and shadow in `<style scoped>`, duplicating the `--app-chrome-*` design
   tokens already defined in [assets/css/main.css](../../assets/css/main.css). Both a
   `:root` and a `.dark .feed-composer` block are maintained by hand.

The `components/explore` tree was audited and already routes every color through
`--explore-*` tokens; no hardcoded grays remain there. The fix is confined to
`pages/feed.vue`.

## Out of scope

- A standalone `--feed-composer-*` token namespace. The existing `--app-chrome-*`
  tokens describe exactly this surface ("translucent floating UI on top of body
  bg"), so a new namespace would be ceremony without value.
- Sweeping every remaining `text-gray-*` / `bg-gray-*` in `pages/feed.vue` (root
  background, empty-state copy, author-filter chip). Those work in both themes
  and are not part of the reported bug. Tracked for a follow-up cleanup.

## Approach

Replace the composer's hardcoded color values with the project's existing
`--app-chrome-*` tokens, and let the theme switch on its own through
`html[data-theme="dark"]`.

### Changes in [pages/feed.vue](../../pages/feed.vue)

**Textarea (two instances — globe overlay and feed list):**

```diff
- class="... text-gray-950 placeholder:text-gray-500 ... dark:text-white dark:placeholder:text-white/45"
+ class="... text-[var(--app-chrome-text)] placeholder:text-[var(--app-chrome-text-muted)] ..."
```

**Counter `0/500` and similar muted labels inside composer:**

```diff
- class="text-xs text-gray-500 dark:text-white/45"
+ class="text-xs text-[var(--app-chrome-text-faint)]"
```

**Photo button hover state in feed-list composer:**

```diff
- class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-emerald dark:hover:bg-white/5"
+ class="rounded-lg p-2 text-[var(--app-chrome-text-faint)] transition-colors hover:bg-[var(--app-chrome-control-hover)] hover:text-brand-emerald"
```

**`<style scoped>` block — collapse the two-theme version into one token-driven rule:**

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

The two `.dark .feed-composer{...}` overrides are deleted — tokens flip
automatically when `html[data-theme="dark"]` is set.

## Verification

1. Run the app, navigate to `/feed`, toggle theme via the header sun/moon button.
   - In dark mode the placeholder "Поделитесь историей к фото..." is legible
     against the composer surface.
   - In light mode the placeholder remains visible and the composer keeps its
     soft glass appearance.
2. Switch to the Globe tab on `/feed`. The floating composer behaves the same
   way in both themes.
3. Type into the textarea — typed text uses `--app-chrome-text` and is readable
   in both themes.
4. The character counter `N/500` is visible but de-emphasized in both themes.

## Risks

- `--app-chrome-control-bg` is a touch more transparent than the previous
  hand-tuned `rgba(255,255,255,0.72)` / `rgba(5,5,5,0.54)`. If the visual
  difference on the Globe tab feels off, we can adjust by adding `--app-chrome-bg`
  there instead of `--app-chrome-control-bg`, or by introducing a dedicated
  `--app-chrome-bg-soft` token. No source-code rollback required.
