# Coding Conventions

**Analysis Date:** 2026-05-08

## Naming Patterns

**Files:**
- Prefer kebab-case for source files, enforced by `unicorn/filename-case` in `eslint.config.mjs`.
- Vue page and API route filenames follow Nuxt route conventions with dynamic params, for example `pages/dashboard/location/[slug]/[id].vue` and `server/api/posts/[id]/comments/[comment-id].delete.ts`.
- Existing PascalCase files in `components/explore/*.vue` should be normalized before relying on the filename lint rule.

**Functions:**
- Use camelCase for functions: `findLocationBySlug`, `insertLocationLog`, `createPost`, `getFeedWithUserLikes`.
- API route handlers are anonymous default exports using `defineEventHandler` or `defineAuthenticatedHandler`.

**Variables:**
- Use camelCase refs/computed values in stores and components: `currentLocationLog`, `nextCursor`, `hasMore`, `mapPoints`.
- Use uppercase constants for static limits and data sets: `MAX_IMAGE_SIZE`, `TOKYO_POINTS`, `CURRENT_LOCATION_PAGES`.

**Types:**
- Use PascalCase type names: `InsertLocation`, `SelectLocationLog`, `MapAdapter`, `FeedPost`.
- Drizzle select/insert types are exported near table definitions in `lib/db/schema/*.ts`.

## Code Style

**Formatting:**
- ESLint and Antfu config are the formatting source of truth in `eslint.config.mjs`.
- Key settings: 2-space indent, semicolons enabled, double quotes, Vue singleline max 2 attributes, multiline max 1 attribute.

**Linting:**
- Run `pnpm lint`.
- Auto-fix with `pnpm lint:fix`.
- Important rules in `eslint.config.mjs`:
  - `node/no-process-env`: error.
  - `no-console`: warning.
  - `ts/consistent-type-definitions`: type aliases over interfaces.
  - `perfectionist/sort-imports`: sorted imports.
  - `unicorn/filename-case`: kebab-case files.

## Import Organization

**Order:**
1. Type-only imports.
2. Package imports.
3. Local app aliases such as `~/lib/...`.
4. Relative imports.

**Path Aliases:**
- Use Nuxt `~` alias for app-root imports: `~/lib/db/queries/location`, `~/utils/define-authenticated-handler`.
- Relative imports are common inside cohesive subtrees such as `lib/db/schema/**` and `lib/map/**`.

## Error Handling

**Patterns:**
- Validate request bodies with `readValidatedBody(event, schema.safeParse)` and return 422 with `sendError(event, createError(...))`.
- Validate query params with Zod before database calls, for example `server/api/feed.get.ts`.
- Return 401 through `utils/define-authenticated-handler.ts` for missing users.
- Return 404/409 for missing rows and duplicate business constraints in endpoint handlers.
- Unexpected errors usually rethrow to Nuxt/Sentry after known cases are handled.

## Logging

**Framework:** console plus Sentry.

**Patterns:**
- Server runtime has Sentry config in `sentry.server.config.ts`.
- Client runtime has Sentry config in `sentry.client.config.ts`.
- `server/plugins/catch-unhandled.ts` sanitizes unhandled rejection messages and truncates stacks.
- Direct `console.log`/`console.error` remains in runtime paths and should be kept out of new code unless temporary and removed before commit.

## Comments

**When to Comment:**
- Use comments for non-obvious lifecycle constraints, for example map load readiness in `composables/useMapbox.ts`.
- Avoid comments that restate simple code.

**JSDoc/TSDoc:**
- Not a dominant convention. Types are usually self-describing through TypeScript aliases and Drizzle inference.

## Function Design

**Size:**
- API handlers are generally short orchestration functions.
- Query functions should stay focused on one persistence operation in `lib/db/queries/**`.
- Larger UI logic exists in stores/components; when adding behavior, prefer extracting reusable pieces to stores/composables.

**Parameters:**
- Pass `userId` explicitly into DB query functions to enforce ownership at the data access layer.
- Pass route params from handlers after coercion/validation where needed.

**Return Values:**
- Query functions return Drizzle rows, `undefined`, or pagination objects.
- API handlers return serializable objects directly.
- Pinia actions mutate refs and return void unless data is needed by callers.

## Module Design

**Exports:**
- Schema modules export table, relations, insert/select types, and Zod insert schema when applicable.
- Query modules export named functions only.
- Stores export `useXStore` setup stores.

**Barrel Files:**
- `lib/db/schema/index.ts` exports all schema modules and is used by Drizzle and Better Auth.
- `lib/map/index.ts` exports adapter types and default map adapter factory.

## UI Conventions

**Components:**
- Use Nuxt/Vue SFCs with `<script setup lang="ts">`.
- Client-only map components use `.client.vue`, for example `components/app/map.client.vue` and `components/explore/MapView.client.vue`.

**Styling:**
- Use Tailwind utility classes and daisyUI theme tokens.
- Global theme colors and fonts live in `assets/css/main.css`.

## API Conventions

**Authenticated endpoints:**
- Wrap handlers in `defineAuthenticatedHandler` from `utils/define-authenticated-handler.ts`.
- Use `event.context.user.id` for ownership and relation writes.

**Validation:**
- Prefer Drizzle-generated insert schemas for database-backed create/update operations.
- Use standalone Zod schemas for non-table request shapes such as `server/api/feed.get.ts` and `server/api/locations/[slug]/[id]/sign-images.post.ts`.

---

*Convention analysis: 2026-05-08*
