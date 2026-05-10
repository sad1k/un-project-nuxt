<!-- refreshed: 2026-05-08 -->
# Architecture

**Analysis Date:** 2026-05-08

## System Overview

```text
Browser / Nuxt App
  pages/*.vue, layouts/default.vue
  components/**, stores/*.ts, composables/*.ts
        |
        | $fetch / $csrfFetch / Better Auth client
        v
Nuxt Nitro Server
  server/middleware/auth.ts
  server/api/** handlers
        |
        | domain queries / validation / adapters
        v
Application Libraries
  lib/db/schema/**, lib/db/queries/**
  lib/auth.ts, lib/env.ts, lib/map/**
  utils/**
        |
        | Drizzle/libSQL, AWS SDK, fetch
        v
External Systems
  Turso SQLite, S3-compatible storage, Nominatim, OAuth providers, Sentry, map providers
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Nuxt config | Modules, SSR mode, route rules, public runtime config, Sentry, dev port | `nuxt.config.ts` |
| Auth server | Better Auth providers, Drizzle adapter, session hook | `lib/auth.ts` |
| Auth middleware | Load `event.context.user` and redirect protected dashboard pages | `server/middleware/auth.ts` |
| Auth guard wrapper | Enforce user presence for API handlers | `utils/define-authenticated-handler.ts` |
| DB connection | Drizzle/libSQL singleton with schema | `lib/db/index.ts` |
| DB schema | Auth, locations, logs, images, posts, likes, comments | `lib/db/schema/**` |
| DB query layer | Reusable data access functions | `lib/db/queries/**` |
| Location API | CRUD for places and trip log entries | `server/api/locations**` |
| Feed API | Feed pagination, publishing, likes, comments | `server/api/feed.get.ts`, `server/api/posts/**` |
| Search API | Authenticated Nominatim proxy with Nitro cache | `server/api/search-locations.get.ts` |
| S3 image flow | Presigned uploads, metadata insert, object delete | `server/api/locations/[slug]/[id]/sign-images.post.ts`, `server/api/locations/[slug]/[id]/image.post.ts` |
| Client state | Auth/session, locations/sidebar/map, feed | `stores/auth.ts`, `stores/location.ts`, `stores/map.ts`, `stores/feed.ts` |
| Map adapter | Provider-neutral map operations | `lib/map/map-adapter.types.ts`, `lib/map/maplibre-adapter.ts`, `lib/map/yndxmap-adapter.ts` |
| Explore prototype | Route generator and Mapbox globe route view | `pages/explore.vue`, `composables/useRouteGenerator.ts`, `composables/useMapbox.ts` |

## Pattern Overview

**Overall:** Modular Nuxt client-server monolith with thin Nitro handlers, a Drizzle query/schema layer, Pinia client state, and provider adapters for maps/storage/auth.

**Key Characteristics:**
- Feature folders are mostly framework-driven: pages in `pages/**`, endpoints in `server/api/**`, shared code in `lib/**`, state in `stores/**`.
- Server input validation uses Zod directly or Drizzle-generated Zod schemas.
- API handlers prefer small route files and delegate persistence to `lib/db/queries/**`.
- Client routes call REST-style endpoints with `$fetch` or `$csrfFetch`.
- Planned AI/PWA elements exist in diagrams, but no AI endpoint or service worker source is present.

## Layers

**Client UI layer:**
- Purpose: Render pages, forms, maps, image lists, feed interactions.
- Location: `pages/**`, `components/**`, `layouts/default.vue`.
- Contains: Vue SFCs, page-level route logic, form components, feed cards, map views.
- Depends on: `stores/**`, `composables/**`, runtime config, `$fetch`.
- Used by: Nuxt router and browser runtime.

**Client state/composables layer:**
- Purpose: Share session, feed, location, sidebar, and map state across components.
- Location: `stores/*.ts`, `composables/*.ts`.
- Contains: Pinia setup stores, route generator prototype, Mapbox helper.
- Depends on: Nuxt composables, API endpoints, `lib/types`, map adapters.
- Used by: Pages and components.

**Server API layer:**
- Purpose: Authenticate, validate, orchestrate requests, return HTTP responses.
- Location: `server/api/**`, `server/middleware/auth.ts`, `server/plugins/catch-unhandled.ts`.
- Contains: Nitro/H3 handlers.
- Depends on: `lib/auth.ts`, `lib/db/queries/**`, `lib/db/schema/**`, `utils/**`.
- Used by: Browser `$fetch`, Better Auth callbacks, S3 upload workflow.

**Domain/data layer:**
- Purpose: Define data model and persistence operations.
- Location: `lib/db/schema/**`, `lib/db/queries/**`, `lib/db/index.ts`.
- Contains: Drizzle table definitions, relations, query functions, insert schemas.
- Depends on: Drizzle ORM, libSQL, Zod through `drizzle-zod`.
- Used by: Server API handlers and Better Auth adapter.

**Integration layer:**
- Purpose: Encapsulate external providers.
- Location: `lib/auth.ts`, `utils/create-s3-client.ts`, `lib/map/**`, `server/api/search-locations.get.ts`, `sentry.*.config.ts`.
- Contains: Better Auth config, AWS S3 client factory, map adapters, Nominatim fetch, Sentry setup.
- Depends on: provider SDKs and env schema.
- Used by: API handlers, stores, components.

## Data Flow

### Authenticated Location Creation

1. Client submits a location form from `pages/dashboard/add.vue`.
2. Page sends `$csrfFetch("/api/locations", { method: "POST" })` in `pages/dashboard/add.vue`.
3. `server/middleware/auth.ts` populates `event.context.user`.
4. `utils/define-authenticated-handler.ts` rejects unauthenticated requests.
5. `server/api/locations.post.ts` validates with `InsertLocationSchema`, checks duplicate name/slug, generates a slug, and calls `insertLocation`.
6. `lib/db/queries/location.ts` inserts into `location` with Drizzle and returns the created row.

### Image Upload Flow

1. Client resizes and hashes an image in `pages/dashboard/location/[slug]/[id]/images.vue`.
2. Client requests a presigned POST from `server/api/locations/[slug]/[id]/sign-images.post.ts`.
3. Handler validates content length/checksum, verifies the log via `event.$fetch("/api/locations/{slug}/{id}")`, and signs an S3 key.
4. Client uploads directly to S3 using returned `url` and `fields`.
5. Client records metadata through `server/api/locations/[slug]/[id]/image.post.ts`.
6. Metadata is inserted with `insertLocationLogImage` in `lib/db/queries/location-log-image.ts`.

### Feed Flow

1. `pages/feed.vue` and `stores/feed.ts` request `/api/feed` with an optional cursor.
2. `server/api/feed.get.ts` validates query params with Zod.
3. `lib/db/queries/post.ts` joins posts, users, images, like counts, comment counts, and current user's like state.
4. Client store appends items and tracks `nextCursor` and `hasMore`.
5. Likes use optimistic updates in `stores/feed.ts` and API endpoints under `server/api/posts/[id]/like.*.ts`.

### Search Flow

1. `components/app/search-locations.vue` calls `/api/search-locations` with query `q`.
2. `server/api/search-locations.get.ts` validates with `SearchLocationQuery`.
3. Handler calls Nominatim via `fetch`, caches by query string for 24 hours, and returns typed search results.

**State Management:**
- Pinia stores hold auth (`stores/auth.ts`), dashboard location state (`stores/location.ts`), map state (`stores/map.ts`), sidebar state (`stores/sidebar.ts`), and feed state (`stores/feed.ts`).
- Server-side state is database-backed through Drizzle. Request user state lives in `event.context.user`.

## Key Abstractions

**Authenticated handler wrapper:**
- Purpose: Centralize API auth checks.
- Examples: `utils/define-authenticated-handler.ts`, used by most mutating endpoints in `server/api/**`.
- Pattern: Higher-order handler wrapping H3 `defineEventHandler`.

**Drizzle schema plus query functions:**
- Purpose: Keep table definitions and data access reusable.
- Examples: `lib/db/schema/location.ts`, `lib/db/queries/location.ts`, `lib/db/queries/post.ts`.
- Pattern: Table schema files plus focused query modules.

**Map adapter interface:**
- Purpose: Decouple map store from MapLibre/Yandex provider APIs.
- Examples: `lib/map/map-adapter.types.ts`, `lib/map/maplibre-adapter.ts`, `lib/map/yndxmap-adapter.ts`, `stores/map.ts`.
- Pattern: Interface plus provider-specific factories.

**Runtime env schema:**
- Purpose: Fail fast when required environment variables are missing.
- Examples: `lib/env.ts`, `lib/try-parse-env.ts`.
- Pattern: Zod schema parsed at import time.

## Entry Points

**Nuxt app shell:**
- Location: `app.vue`, `layouts/default.vue`.
- Triggers: Browser route load.
- Responsibilities: Render page tree, initialize auth store in default layout.

**Pages:**
- Location: `pages/**`.
- Triggers: Nuxt file-based router.
- Responsibilities: Dashboard, feed, explore, auth redirects, CRUD screens.

**Nitro API:**
- Location: `server/api/**`.
- Triggers: HTTP requests under `/api`.
- Responsibilities: REST endpoints for locations, images, feed, comments, likes, search, auth.

**Middleware/plugins:**
- Location: `server/middleware/auth.ts`, `server/plugins/catch-unhandled.ts`.
- Triggers: Nitro request lifecycle and server runtime lifecycle.
- Responsibilities: Session context, protected route redirects, unhandled rejection logging.

## Architectural Constraints

- **Threading:** Single Node/Nitro request model; browser map animation uses `requestAnimationFrame` in `composables/useMapbox.ts`.
- **Global state:** `composables/useMapbox.ts` uses module-level refs (`mapInstance`, `activeMarkers`, timers). This makes all consumers share one Mapbox instance.
- **Environment parsing:** `lib/env.ts` parses required variables at import time. Any module importing it can fail startup if env is incomplete.
- **Auth scope:** `defineAuthenticatedHandler` depends on `server/middleware/auth.ts` having populated `event.context.user`.
- **Circular imports:** No explicit circular import check was run; schema relation files import each other through Drizzle relation callbacks and `lib/db/schema/index.ts` barrels.

## Anti-Patterns

### Planned Architecture Treated As Implemented

**What happens:** Architecture diagrams describe AI chat, SSE, AI conversation tables, service worker, and push/offline behavior.
**Why it's wrong:** Source does not contain `server/api/ai/**`, AI DB tables, a service worker, or Nuxt PWA module setup.
**Do this instead:** Treat diagrams such as `c4_diagram.puml`, `Рис5_Последовательность_AI.puml`, and `Рис6_PWA_ServiceWorker.puml` as design intent until source files exist.

### Handler-Level Error Duplication

**What happens:** Many API files manually shape Zod errors and `createError` responses.
**Why it's wrong:** Inconsistent status codes/messages and duplicated reduce/map logic make future changes error-prone.
**Do this instead:** Reuse a small validation/error helper in `utils/**`, following the wrapper pattern in `utils/define-authenticated-handler.ts`.

### Direct Console Logging In Runtime Paths

**What happens:** API handlers and stores log request/provider details directly.
**Why it's wrong:** Logs can expose operational details and violate the configured `no-console` warning rule.
**Do this instead:** Route server logging through a sanitizing helper or Sentry breadcrumbs, following the sanitization idea in `server/plugins/catch-unhandled.ts`.

## Error Handling

**Strategy:** Validate early with Zod, return H3 errors with specific status codes, and let unexpected errors bubble to Nuxt/Sentry.

**Patterns:**
- `readValidatedBody(event, schema.safeParse)` with 422 responses in `server/api/locations.post.ts` and `server/api/posts/index.post.ts`.
- `getValidatedQuery(event, SearchLocationQuery.parse)` in `server/api/search-locations.get.ts`.
- Ownership checks are enforced in Drizzle query `where` clauses with `userId`, for example `lib/db/queries/location.ts`.
- Sentry is initialized for client and server in `sentry.client.config.ts` and `sentry.server.config.ts`.

## Cross-Cutting Concerns

**Logging:** Direct `console.*` plus Sentry. Sanitized unhandled rejection logging exists in `server/plugins/catch-unhandled.ts`.
**Validation:** Zod and Drizzle-generated insert schemas.
**Authentication:** Better Auth sessions loaded into Nitro context, plus `nuxt-csurf` for mutating client requests.
**Authorization:** Mostly user ownership enforced by query filters (`eq(...userId, event.context.user.id)`).
**Storage:** Images are stored in S3-compatible object storage; metadata is stored in Turso.

---

*Architecture analysis: 2026-05-08*

## Phase 3 Update - AI Route Architecture

AI route generation is now an authenticated route-event pipeline:

1. `components/explore/route-panel.vue` submits `useExploreContext().requestContext` through `useAiRouteSession().generateRoute`.
2. `server/api/ai/route.post.ts` authenticates with `defineAuthenticatedHandler` and validates the request with `RouteGenerationRequestSchema`.
3. `lib/ai/route-context.ts` re-reads selected saved places and diary logs by authenticated `userId`, then caps/truncates provider-bound context.
4. `lib/ai/openai-compatible.ts` streams OpenAI-compatible Responses API chunks using server-only env config.
5. The endpoint validates app route events with `RouteEventEnvelopeSchema` before persisting or emitting them.
6. `lib/db/queries/ai-route.ts` persists user-owned sessions, variants, route points, and event logs.
7. The client stores points by `variantId`, supports `activeVariantId` switching, and keeps follow-up refinement secondary to the map-first route state.

Phase 4 should use `.planning/phases/03-ai-route-generation-and-streaming/03-HANDOFF.md` as the map-rendering contract.
