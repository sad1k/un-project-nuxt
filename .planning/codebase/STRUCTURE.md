# Codebase Structure

**Analysis Date:** 2026-05-08

## Directory Layout

```text
un-project-nuxt/
|-- app.vue                         # Nuxt root component
|-- nuxt.config.ts                  # Nuxt modules, runtime config, route rules, Sentry, Vite
|-- package.json                    # Scripts, dependencies, pnpm metadata
|-- drizzle.config.ts               # Drizzle Kit/Turso migration config
|-- eslint.config.mjs               # Antfu/Nuxt lint and formatting rules
|-- assets/css/main.css             # Tailwind v4, daisyUI, app theme tokens
|-- components/                     # Shared Vue components
|-- components/app/                 # App shell/map/search/nav UI
|-- components/feed/                # Social feed UI
|-- components/explore/             # Explore route prototype UI
|-- composables/                    # Shared Vue/Nuxt composables
|-- layouts/                        # Nuxt layouts
|-- lib/                            # Auth, env, database, map adapters, shared types
|-- lib/db/schema/                  # Drizzle table schemas and relations
|-- lib/db/queries/                 # Data access functions
|-- lib/db/migrations/              # Generated SQL and Drizzle metadata
|-- pages/                          # Nuxt route pages
|-- public/                         # Static public assets and map style JSON
|-- server/api/                     # Nitro API routes
|-- server/middleware/              # Nitro middleware
|-- server/plugins/                 # Nitro runtime plugins
|-- stores/                         # Pinia stores
|-- utils/                          # App utilities
|-- docs/                           # Project docs
|-- .github/workflows/              # CI workflows
|-- .husky/                         # Git hooks
|-- *.dot, *.puml, *.png, *.svg     # Architecture/research diagrams
```

## Directory Purposes

**`pages/`:**
- Purpose: Nuxt file-based route views.
- Contains: landing page, dashboard CRUD, feed, auth pages, explore prototype.
- Key files: `pages/index.vue`, `pages/dashboard.vue`, `pages/feed.vue`, `pages/explore.vue`, `pages/dashboard/location/[slug]/[id]/images.vue`.

**`components/`:**
- Purpose: Reusable Vue UI.
- Contains: forms, map/search/nav components, feed components, image/file upload components.
- Key files: `components/location-base-form.vue`, `components/app/search-locations.vue`, `components/app/map.client.vue`, `components/feed/post-card.vue`.

**`stores/`:**
- Purpose: Pinia client-side state.
- Contains: auth, feed, map, sidebar, location state.
- Key files: `stores/auth.ts`, `stores/feed.ts`, `stores/location.ts`, `stores/map.ts`.

**`server/api/`:**
- Purpose: Nitro API endpoint implementations.
- Contains: REST-like handlers for locations, trip logs, images, feed, posts, comments, likes, auth, search, Sentry example.
- Key files: `server/api/locations.post.ts`, `server/api/feed.get.ts`, `server/api/posts/index.post.ts`, `server/api/search-locations.get.ts`.

**`lib/db/`:**
- Purpose: Persistence layer.
- Contains: Drizzle connection, table schemas, relations, migrations, query functions.
- Key files: `lib/db/index.ts`, `lib/db/schema/index.ts`, `lib/db/queries/location.ts`, `lib/db/queries/post.ts`.

**`lib/map/`:**
- Purpose: Provider-neutral map abstraction.
- Contains: adapter interface, MapLibre adapter, Yandex Maps adapter, default adapter export.
- Key files: `lib/map/map-adapter.types.ts`, `lib/map/maplibre-adapter.ts`, `lib/map/yndxmap-adapter.ts`.

**`utils/`:**
- Purpose: Cross-cutting helpers.
- Contains: auth handler wrapper, S3 client factory, date formatting.
- Key files: `utils/define-authenticated-handler.ts`, `utils/create-s3-client.ts`, `utils/format-date.ts`.

**`docs/`:**
- Purpose: Human-readable documentation.
- Contains: database schema doc.
- Key files: `docs/database-schema.md`.

## Key File Locations

**Entry Points:**
- `app.vue`: Nuxt root layout host.
- `layouts/default.vue`: Auth store initialization and common app shell.
- `server/api/[...auth].ts`: Better Auth route entry point.
- `server/middleware/auth.ts`: Session context entry point for all requests.

**Configuration:**
- `nuxt.config.ts`: Nuxt modules, SSR, route rules, runtime config.
- `package.json`: Scripts and dependency inventory.
- `drizzle.config.ts`: Database migration settings.
- `eslint.config.mjs`: Formatting and lint rules.
- `tsconfig.json`: Nuxt TypeScript extension and Yandex type roots.
- `.github/workflows/lint.yaml`: CI lint workflow.

**Core Logic:**
- `lib/auth.ts`: Better Auth server configuration.
- `lib/env.ts`: Zod environment schema.
- `lib/db/schema/*.ts`: Database model.
- `lib/db/queries/*.ts`: Database operations.
- `stores/location.ts`: Dashboard location/map/sidebar state coordination.
- `stores/feed.ts`: Feed pagination and optimistic like behavior.

**Testing:**
- No test directories or `*.test.*` / `*.spec.*` files detected.
- Current quality commands are `pnpm lint` and `pnpm typecheck` from `package.json`.

## Naming Conventions

**Files:**
- Vue components use kebab-case: `components/location-base-form.vue`, `components/feed/post-card.vue`.
- Server API files follow Nuxt route naming: `server/api/locations.post.ts`, `server/api/posts/[id]/like.post.ts`.
- Dynamic route params use bracket names: `pages/dashboard/location/[slug]/[id].vue`.
- DB schema/query files use kebab-case domain names: `lib/db/schema/location-log-image.ts`, `lib/db/queries/post-comment.ts`.
- Some newer Explore components use PascalCase (`components/explore/HeaderOverlay.vue`, `components/explore/MapView.client.vue`), which conflicts with the ESLint `unicorn/filename-case` kebab-case rule.

**Directories:**
- Nuxt framework directories (`pages`, `components`, `layouts`, `server`, `stores`, `composables`, `public`, `assets`) follow Nuxt conventions.
- Feature grouping is partial: feed UI lives in `components/feed`, but feed store/API/query are in framework-level directories.

## Where to Add New Code

**New dashboard page:**
- Page route: `pages/dashboard/**`.
- Shared component: `components/**`.
- State: `stores/**` if shared across routes.
- API: `server/api/**`.
- DB access: `lib/db/queries/**`.

**New database table:**
- Schema: `lib/db/schema/<domain>.ts`.
- Barrel export: `lib/db/schema/index.ts`.
- Migration: generated into `lib/db/migrations/**` through Drizzle Kit.
- Queries: `lib/db/queries/<domain>.ts`.

**New authenticated API endpoint:**
- Handler: `server/api/<resource>.<method>.ts`.
- Wrap with `utils/define-authenticated-handler.ts`.
- Validate inputs with Zod or a Drizzle-generated insert schema.
- Put reusable DB operations in `lib/db/queries/**`.

**New external provider:**
- Client factory or adapter: `lib/**` or `utils/**`.
- Env schema additions: `lib/env.ts`.
- Server route usage: `server/api/**`.
- Public config only when safe for browser exposure: `nuxt.config.ts` `runtimeConfig.public`.

**New map provider behavior:**
- Adapter type change: `lib/map/map-adapter.types.ts`.
- Provider implementation: `lib/map/<provider>-adapter.ts`.
- Store usage: `stores/map.ts`.
- Component hookup: `components/app/*.client.vue` or `components/explore/*.client.vue`.

**Tests:**
- No local convention exists yet. Introduce tests with explicit config and document the chosen pattern in this file and `TESTING.md`.

## Special Directories

**`.nuxt/`:**
- Purpose: Nuxt generated build/dev metadata.
- Generated: Yes.
- Committed: No.

**`.output/`:**
- Purpose: Nuxt/Nitro build output.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

**`lib/db/migrations/`:**
- Purpose: Drizzle migration SQL and metadata.
- Generated: Yes, but source-controlled migration artifacts are expected.
- Committed: Yes.

**Diagram/document artifacts at repo root:**
- Purpose: Research/report figures and architecture descriptions.
- Generated: Mixed.
- Committed: Currently untracked in this working tree.

---

*Structure analysis: 2026-05-08*

## Phase 3 Update - AI Route Generation

New Phase 3 source locations:

- `lib/ai/route-contract.ts` - Zod contract for route requests, route points, and app route events.
- `lib/ai/openai-compatible.ts` - Server-only OpenAI-compatible Responses API streaming adapter.
- `lib/ai/route-context.ts` - Selected Explore context summarizer for provider input.
- `lib/ai/route-prompts.ts` - Route-generation prompt instructions and input assembly.
- `server/api/ai/route.post.ts` - Authenticated route-generation SSE endpoint.
- `lib/db/schema/ai-route.ts` - AI route sessions, messages, variants, points, and event log tables.
- `lib/db/queries/ai-route.ts` - Ownership-safe route persistence and history helpers.
- `composables/use-ai-route-session.ts` - Client route stream state, variants, and follow-up submission.
- `components/explore/route-history.vue` - Generated route variant switcher.
- `components/explore/route-follow-up.vue` - Follow-up refinement input.
- `tests/server/ai-route-*.test.mjs` - Source-level AI route regression tests.
