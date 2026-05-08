# Phase 1 Research: Explore Scope and Verification Foundation

**Date:** 2026-05-08
**Phase:** 01 - Explore Scope and Verification Foundation
**Status:** Complete

## Research Goal

Establish what Phase 1 must plan before Explore implementation begins: a scoped verification path, an honest baseline of current quality blockers, and a durable contract that preserves the user's Explore intent without treating prototype code as finished behavior.

## Current Implementation Findings

### Explore Prototype State

- `pages/explore.vue` renders a full-screen map shell and overlays `ExploreMapView`, `ExploreHeaderOverlay`, `ExploreRoutePanel`, and `ExploreQuickActions`.
- `composables/useRouteGenerator.ts` is local mock data. It returns Tokyo, Paris, or fallback route points after a timeout.
- `composables/useMapbox.ts` owns a module-level Mapbox singleton, marker lifecycle, route line drawing, and fit-to-route animation behavior.
- `components/explore/` preserves strong product intent, but the files do not currently satisfy project lint conventions.

### Verification State

- `package.json` has `lint`, `lint:fix`, `typecheck`, build/dev scripts, and no `test` or focused verification script.
- `eslint.config.mjs` already ignores `.omx/**`, `.planning/**`, `AGENTS.md`, migrations, public assets, lockfiles, and generated/dependency directories.
- `pnpm` is not available on this shell PATH. Local binaries exist under `node_modules/.bin`, so package scripts should remain the source of truth and local direct commands can be used as a fallback.
- Running local ESLint inside the sandbox failed with `EPERM: operation not permitted, lstat 'C:\Users\misha'`; rerunning outside the sandbox succeeded and produced the current lint baseline.
- `nuxi typecheck` runs outside the sandbox and fails on existing source issues.

### Current Lint Baseline

Command used:

```powershell
.\node_modules\.bin\eslint.CMD .
```

Result: failed with 398 problems, including 376 errors and 22 warnings.

Dominant blockers:

- `components/explore/HeaderOverlay.vue`, `MapView.client.vue`, `QuickActions.vue`, `RouteMarker.ts`, and `RoutePanel.vue` violate kebab-case filename and formatting rules.
- `composables/useMapbox.ts` and `composables/useRouteGenerator.ts` violate kebab-case filename and formatting rules.
- `pages/explore.vue` has style errors.
- `lib/map/map-adapter.types.ts` has an unused `MapPoint` import.
- `package.json` dependency keys are not sorted.
- Several existing files emit `no-console` warnings.

Important: `.planning/**`, `.omx/**`, and `AGENTS.md` did not appear as lint findings, which supports FOUND-01's artifact-exclusion requirement.

### Current Typecheck Baseline

Command used:

```powershell
.\node_modules\.bin\nuxi.CMD typecheck
```

Result: failed with existing blockers:

- Slot typing issues in `components/animated-list.vue`.
- Missing `vue-easy-lightbox` type declarations in `components/feed/post-card.vue` and `components/image-list.vue`.
- File upload prop mismatch in `components/file-upload.vue` and image page usage.
- Implicit any array in `components/github-globe.vue`.
- Drizzle/Zod type issues in `lib/db/queries/location.ts`, `lib/db/schema/location.ts`, and `lib/db/schema/location-log.ts`.
- Invalid color prop in `pages/dashboard.vue`.
- `never` inference issues in `pages/dashboard/location/[slug]/[id]/images.vue`.
- Null assignment issue in `pages/dashboard/location/[slug]/edit.vue`.
- Bad `defineEventHandler` import in `server/api/sentry-example-api.ts`.

These are not all Explore-specific, but they currently block using global typecheck as a clean Phase 2+ gate.

## Architectural Responsibility Map

| Capability | Owning Tier | Existing/Planned Artifacts | Notes |
|------------|-------------|----------------------------|-------|
| Planning artifacts and phase contracts | GSD planning docs | `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, phase docs | Generated workflow artifacts, not app source. |
| Source linting | Tooling/config | `eslint.config.mjs`, `package.json` scripts | Must keep `.planning/**`, `.omx/**`, and `AGENTS.md` excluded. |
| Focused server/data tests | Tooling/tests | `package.json`, `scripts/`, `tests/server/` | Prefer dependency-free Node test foundation unless a future phase explicitly approves a dev dependency. |
| Explore prototype contract | Planning/docs | phase contract docs, current `components/explore/`, `pages/explore.vue`, `composables/useRouteGenerator.ts` | Treat prototype as intent, not final source of truth. |
| Future Explore implementation | Nuxt client/server app | `pages/explore.vue`, `components/explore/`, `composables/`, `server/api/ai/**`, `lib/db/**` | Later phases own implementation. |

## Recommendations For Phase 1 Plans

1. Add a focused verification foundation without adding dependencies:
   - Create or update package scripts for source lint, focused server tests, and a combined Explore foundation verification command.
   - Add a small dependency-free test runner or documented test harness under `scripts/` and `tests/server/`.
   - Record current lint/typecheck blockers in a phase-local verification baseline.

2. Lock Explore scope in a traceable contract:
   - Map D-01 through D-16 from `01-CONTEXT.md` to requirements and future roadmap phases.
   - Preserve template intent for `components/explore/`, `pages/explore.vue`, and `composables/useRouteGenerator.ts`.
   - Make clear that provider-heavy features may be staged by phase, but the full target flow remains the contract.

3. Do not implement the AI route planner in Phase 1:
   - Phase 1 should not create `server/api/ai/**`, AI tables, route streaming UI, weather providers, or diary save flows.
   - Those are planned for Phases 2 through 6.

## Open Questions (RESOLVED)

1. **Should Phase 1 add a new test dependency?** RESOLVED: No. The repo guide says no new dependencies without explicit request. Phase 1 should establish a dependency-free focused test path and leave richer test tooling to a later explicit decision.
2. **Should Phase 1 fix every existing lint/typecheck blocker?** RESOLVED: No. Phase 1 must list or resolve blockers relevant to Explore work. It should create a scoped verification path so new work can be checked even while unrelated historical blockers remain.
3. **Should Explore prototype files be treated as final UI?** RESOLVED: No. `01-CONTEXT.md` D-03 says they are template/prototype assets whose product intent should be preserved while implementation and visuals may change.

## Research Complete

Phase 1 is ready for planning. The plan should produce small executable slices that make verification usable and preserve the Explore feature contract before implementation phases begin.
