# External Integrations

**Analysis Date:** 2026-05-08

## APIs & External Services

**Geocoding:**
- Nominatim/OpenStreetMap search - used by authenticated location search in `server/api/search-locations.get.ts`.
  - SDK/Client: native `fetch`.
  - Auth: none detected.
  - Notes: the handler sets a hard-coded User-Agent and caches results for 24 hours with `defineCachedFunction`.

**Object storage:**
- S3-compatible storage - used for trip image upload, retrieval, and deletion.
  - SDK/Client: `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`.
  - Auth: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_BUCKET_URL` from `lib/env.ts`.
  - Implementation: `utils/create-s3-client.ts`, `server/api/locations/[slug]/[id]/sign-images.post.ts`, `server/api/locations/[slug]/[id]/image.post.ts`, `server/api/locations/[slug]/[id]/images/[image-id].delete.ts`.

**Maps:**
- MapLibre GL - dashboard map rendering through `@indoorequal/vue-maplibre-gl` and `lib/map/maplibre-adapter.ts`.
- Mapbox GL - Explore route/globe prototype through `composables/useMapbox.ts` and `components/explore/MapView.client.vue`.
  - Auth: public `MAPBOX_TOKEN` exposed through `runtimeConfig.public.mapboxToken` in `nuxt.config.ts`.
- Yandex Maps - alternate adapter in `components/app/yndx-map.client.vue` and `lib/map/yndxmap-adapter.ts`.

**LLM / AI:**
- Planned in diagrams and PlantUML artifacts, not implemented as Nitro endpoints in current source.
  - Evidence of planned API: `/api/ai/chat` appears in `Рис5_Последовательность_AI.puml` and `c4_diagram.puml`.
  - No `server/api/ai/**`, OpenAI/Anthropic SDK dependency, `EventSource`, or server streaming implementation detected in source.
  - `composables/useRouteGenerator.ts` contains a local mocked route generator for Tokyo, Paris, and fallback points.

## Data Storage

**Databases:**
- Turso SQLite/libSQL.
  - Connection: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
  - Client: Drizzle ORM in `lib/db/index.ts`.
  - Config: `drizzle.config.ts`.
  - Schema: `lib/db/schema/*.ts`.
  - Migrations: `lib/db/migrations/**`.

**File Storage:**
- S3-compatible object storage.
  - Upload flow: client requests a presigned POST from `server/api/locations/[slug]/[id]/sign-images.post.ts`, uploads directly to the storage URL, then records metadata through `server/api/locations/[slug]/[id]/image.post.ts`.
  - Public image rendering uses `runtimeConfig.public.s3BucketUrl` in `components/image-list.vue`, `components/feed/post-card.vue`, and `pages/dashboard/publish.vue`.

**Caching:**
- Nitro function cache for Nominatim search in `server/api/search-locations.get.ts`.
- No Redis, KV, or separate cache provider detected.

## Authentication & Identity

**Auth Provider:**
- Better Auth with GitHub and Google OAuth.
  - Server implementation: `lib/auth.ts`.
  - Nitro API catch-all: `server/api/[...auth].ts`.
  - Session middleware: `server/middleware/auth.ts`.
  - Client store: `stores/auth.ts`.
  - CSRF integration: `nuxt-csurf` module in `nuxt.config.ts`, `$csrfFetch` usage in pages and stores, explicit `csrf-token` headers in `stores/auth.ts`.

## Monitoring & Observability

**Error Tracking:**
- Sentry through `@sentry/nuxt`.
  - Nuxt module config: `nuxt.config.ts`.
  - Client init: `sentry.client.config.ts`.
  - Server init: `sentry.server.config.ts`.
  - Example endpoint/page: `server/api/sentry-example-api.ts`, `pages/sentry-example-page.vue`.

**Logs:**
- Console logging is used directly in API handlers, middleware, stores, and map code. See `server/api/search-locations.get.ts`, `server/api/locations/[slug]/[id]/sign-images.post.ts`, `stores/map.ts`, `server/middleware/auth.ts`.
- Unhandled rejection handling sanitizes and truncates stack traces in `server/plugins/catch-unhandled.ts`.

## CI/CD & Deployment

**Hosting:**
- Vercel Edge Network is documented in architecture/deployment artifacts (`c4_architecture.dot`, `Рис7_Развёртывание.puml`).
- No `vercel.json` or platform-specific runtime config detected.

**CI Pipeline:**
- GitHub Actions lint workflow in `.github/workflows/lint.yaml`.
- Matrix runs on Node 18.x, 20.x, and 22.x.
- CI currently runs `pnpm install` and `pnpm lint`; no build, typecheck, or tests in the workflow.

## Environment Configuration

**Required env vars:**
- Runtime/app: `NODE_ENV`.
- Database: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Better Auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- OAuth: `AUTH_GITHUB_CLIENT_ID`, `AUTH_GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- S3: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_BUCKET`, `S3_BUCKET_URL`.
- Observability/maps: `SENTRY_DSN`, `MAPBOX_TOKEN`.

**Secrets location:**
- Local `.env` file exists. Do not read or commit its contents.
- GitHub Actions references repository/environment secrets for Turso in `.github/workflows/lint.yaml`.

## Webhooks & Callbacks

**Incoming:**
- Better Auth callbacks are handled through `server/api/[...auth].ts`.
- No custom webhook endpoints detected.

**Outgoing:**
- OAuth provider redirects through Better Auth.
- S3 direct upload target returned by `server/api/locations/[slug]/[id]/sign-images.post.ts`.
- Nominatim HTTP requests from `server/api/search-locations.get.ts`.

---

*Integration audit: 2026-05-08*

## Phase 3 Update - AI Route Provider

OpenAI-compatible route generation is now implemented for Explore.

- Endpoint: `server/api/ai/route.post.ts`.
- Provider adapter: `lib/ai/openai-compatible.ts`, using native `fetch` against `/responses`.
- Server-only env names: optional-at-boot `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, defaulted `OPENAI_ROUTE_MODEL`.
- Contract: `lib/ai/route-contract.ts` validates route events and points before persistence/emission.
- Prompt/context: `lib/ai/route-prompts.ts` and `lib/ai/route-context.ts` keep raw JSON internal and use only selected sidebar context.
- Client: `composables/use-ai-route-session.ts`, `components/explore/route-history.vue`, and `components/explore/route-follow-up.vue`.
- No OpenAI/Anthropic SDK dependency is used.
- Remote Turso schema push is blocked by HTTP 401 as of Phase 3 verification; local Drizzle push against `file:local.db` succeeded.
