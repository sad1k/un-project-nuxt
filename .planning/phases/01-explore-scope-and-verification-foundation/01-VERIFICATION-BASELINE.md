# Phase 1 Verification Baseline

**Date:** 2026-05-08
**Phase:** 01 - Explore Scope and Verification Foundation

## Commands Used

```powershell
.\node_modules\.bin\eslint.CMD .
.\node_modules\.bin\nuxi.CMD typecheck
```

`pnpm` was not available on the shell PATH during planning, so local binaries were used to capture the baseline.

## Lint Baseline

`eslint .` failed with 398 problems: 376 errors and 22 warnings.

Generated workflow artifacts were already excluded from lint. `.planning/**`, `.omx/**`, and `AGENTS.md` did not appear as source lint failures.

After Phase 1 added `lint:source`, this command was also checked:

```powershell
npm run lint:source
```

Result: failed with 19 problems: 7 existing Explore filename errors and 12 existing `no-console` warnings. No `.planning/**`, `.omx/**`, `AGENTS.md`, or new test-runner warning appeared in that output.

## Explore-Relevant Blockers

- `components/explore/HeaderOverlay.vue` violates kebab-case filename and Vue formatting rules.
- `components/explore/MapView.client.vue` violates kebab-case filename and TypeScript/style rules.
- `components/explore/QuickActions.vue` violates kebab-case filename and style rules.
- `components/explore/RouteMarker.ts` violates kebab-case filename and style rules.
- `components/explore/RoutePanel.vue` violates kebab-case filename, style, and Vue formatting rules.
- `composables/useMapbox.ts` violates kebab-case filename and style rules.
- `composables/useRouteGenerator.ts` violates kebab-case filename and style rules.
- `pages/explore.vue` has style errors.

Status: listed, not resolved in Phase 1 Plan 01. Future Explore implementation phases should either rename/normalize these prototype files or replace them while preserving product intent.

## Other Source Lint Blockers

- `lib/map/map-adapter.types.ts` has an unused `MapPoint` import.
- `package.json` dependency key ordering was reported by `jsonc/sort-keys`.
- Several existing source files emit `no-console` warnings.

## Unrelated Existing Blockers

Current `nuxi typecheck` failures outside the Phase 1 verification foundation include:

- Slot typing errors in `components/animated-list.vue`.
- Missing `vue-easy-lightbox` type declarations in `components/feed/post-card.vue` and `components/image-list.vue`.
- File upload type mismatch in `components/file-upload.vue` and the image page.
- Implicit `any[]` in `components/github-globe.vue`.
- Drizzle/Zod type issues in `lib/db/queries/location.ts`, `lib/db/schema/location.ts`, and `lib/db/schema/location-log.ts`.
- Invalid color prop value in `pages/dashboard.vue`.
- `never` inference issues in `pages/dashboard/location/[slug]/[id]/images.vue`.
- Null assignment issue in `pages/dashboard/location/[slug]/edit.vue`.
- Bad `defineEventHandler` import in `server/api/sentry-example-api.ts`.

These blockers prevent using global typecheck as a clean gate today. Phase 1 records them so later phases can distinguish new Explore regressions from existing repository debt.

## Focused Verification Path

Phase 1 adds:

- `lint:source` - runs ESLint while suppressing warnings for ignored planning artifacts.
- `test:server` - runs dependency-free focused server/data tests under `tests/server/`.
- `verify:explore-foundation` - runs the scoped lint and focused server test lane.
