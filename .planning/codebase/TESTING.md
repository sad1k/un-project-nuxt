# Testing Patterns

**Analysis Date:** 2026-05-08

## Test Framework

**Runner:**
- Not detected. `package.json` has no `test`, `test:unit`, `test:e2e`, or coverage script.
- No Vitest, Jest, Playwright, Cypress, Storybook, `@vue/test-utils`, or `happy-dom` dependency detected.

**Assertion Library:**
- Not detected.

**Run Commands:**
```bash
pnpm lint       # Current CI and pre-commit quality gate
pnpm typecheck  # Available Nuxt typecheck command, not wired into CI
```

## Test File Organization

**Location:**
- No test files detected under the repository.
- No `*.test.*` or `*.spec.*` files detected outside ignored/generated dependencies.

**Naming:**
- No established naming pattern.

**Structure:**
```text
No committed test directory or colocated test pattern exists.
```

## Test Structure

**Suite Organization:**
```typescript
// No existing suite pattern detected.
```

**Patterns:**
- No setup/teardown/assertion pattern exists yet.
- Future tests should define the pattern explicitly before broad adoption.

## Mocking

**Framework:** Not detected.

**Patterns:**
```typescript
// No mocking pattern detected.
```

**What to Mock:**
- When a test framework is introduced, mock external systems at the boundary: S3 (`utils/create-s3-client.ts`), Nominatim fetch (`server/api/search-locations.get.ts`), Better Auth session lookup (`server/middleware/auth.ts`), and map SDKs (`lib/map/**`).

**What NOT to Mock:**
- Prefer real Zod schemas and Drizzle query logic for unit/integration tests where an isolated test database is available.
- Avoid mocking ownership checks in query functions such as `lib/db/queries/location.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
// No fixture/factory pattern detected.
```

**Location:**
- Not detected.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# No coverage command configured.
```

## Test Types

**Unit Tests:**
- Not implemented.
- Best first candidates: `utils/format-date.ts`, `lib/try-parse-env.ts`, Zod schemas in `lib/db/schema/*.ts`, slug conflict logic in `server/api/locations.post.ts`.

**Integration Tests:**
- Not implemented.
- Best first candidates: authenticated CRUD endpoints under `server/api/locations**`, feed pagination in `server/api/feed.get.ts`, S3 metadata flow in `server/api/locations/[slug]/[id]/image.post.ts`.

**E2E Tests:**
- Not implemented.
- Best first candidates: sign in redirect, dashboard location CRUD, image upload happy path with mocked S3, feed like/comment flow.

## Current Quality Gates

**Local:**
- `pnpm lint` through `package.json`.
- `pnpm typecheck` available but not currently part of hooks or CI.
- Husky pre-commit runs lint-staged, which runs `pnpm lint` for matched files.

**CI:**
- `.github/workflows/lint.yaml` runs `pnpm lint` on push and pull requests to `main`.
- CI does not currently run `pnpm build` or `pnpm typecheck`.

## Common Patterns

**Async Testing:**
```typescript
// Future pattern recommendation:
// await endpoint/action under test, then assert returned data and side effects.
```

**Error Testing:**
```typescript
// Future pattern recommendation:
// validate 401/404/409/422 responses for API handlers using malformed input,
// missing auth context, duplicate rows, and missing resources.
```

## Testing Risk Summary

- High-value behavior is currently protected by lint only, not by regression tests.
- Authenticated ownership checks, S3 upload signing, Nominatim failure handling, and feed optimistic updates need tests before refactors.
- Introducing tests will require choosing and configuring a Nuxt-compatible runner such as Vitest/Nuxt test utils; no dependency is currently present.

---

*Testing analysis: 2026-05-08*
