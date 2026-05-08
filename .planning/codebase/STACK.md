# Technology Stack

**Analysis Date:** 2026-05-08

## Languages

**Primary:**
- TypeScript - application code, Nuxt config, Nitro API handlers, Drizzle schema, Pinia stores. See `nuxt.config.ts`, `server/api/locations.post.ts`, `lib/db/schema/location.ts`, `stores/feed.ts`.
- Vue Single File Components - page and component UI. See `pages/feed.vue`, `components/feed/post-card.vue`, `components/app/yndx-map.client.vue`.

**Secondary:**
- SQL - Drizzle-generated SQLite migrations in `lib/db/migrations/*.sql`.
- CSS - Tailwind CSS v4 entrypoint and custom theme tokens in `assets/css/main.css`.
- DOT/PlantUML/Mermaid - architecture and research artifacts in `c4_architecture.dot`, `c4_diagram.puml`, `docs/database-schema.md`.

## Runtime

**Environment:**
- Node.js - Nuxt/Nitro runtime. CI tests linting against Node 18.x, 20.x, and 22.x in `.github/workflows/lint.yaml`.

**Package Manager:**
- pnpm 10.24.0 - declared in `package.json`.
- Lockfile present: `pnpm-lock.yaml`.

## Frameworks

**Core:**
- Nuxt `^3.17.3` - SSR app, Vue routing, Nitro API routes, server middleware. Configured in `nuxt.config.ts`.
- Vue `^3.5.14` - component runtime.
- Pinia `^3.0.2` with `@pinia/nuxt` `0.11.0` - client state in `stores/*.ts`.
- Nitro/H3 - server event handlers under `server/api/**` and `server/middleware/auth.ts`.

**UI and styling:**
- Tailwind CSS `^4.1.7` via `@tailwindcss/vite` in `nuxt.config.ts` and `assets/css/main.css`.
- daisyUI `^5.0.35` configured as a Tailwind plugin in `assets/css/main.css`.
- `@nuxt/icon`, `@nuxtjs/color-mode`, `nuxt-easy-lightbox`, `motion-v`, `three`, and `three-globe` support icons, theme switching, image viewing, and visual effects.

**Validation and forms:**
- Zod `^3.25.20` - environment validation in `lib/env.ts`, API body/query validation in `server/api/**`.
- `drizzle-zod` `^0.8.2` - insert schemas generated from Drizzle tables in `lib/db/schema/*.ts`.
- VeeValidate via `@vee-validate/nuxt` and `@vee-validate/zod` - form validation in components such as `components/location-base-form.vue`.

**Data and auth:**
- Drizzle ORM `^0.43.1` - SQL schema and queries in `lib/db/schema/**` and `lib/db/queries/**`.
- libSQL client `^0.15.7` - Turso SQLite connection through `drizzle-orm/libsql` in `lib/db/index.ts`.
- Better Auth `^1.2.8` - OAuth, sessions, CSRF-aware client calls. Server setup in `lib/auth.ts`, API catch-all in `server/api/[...auth].ts`.

**Maps and media:**
- `@indoorequal/vue-maplibre-gl`, `maplibre-gl`, and `nuxt-maplibre` - dashboard map abstraction in `lib/map/maplibre-adapter.ts`.
- `mapbox-gl` - Explore globe route prototype in `composables/useMapbox.ts`.
- `vue-yandex-maps` and `@yandex/ymaps3-types` - alternate map adapter in `lib/map/yndxmap-adapter.ts`.
- AWS SDK S3 packages - upload signing and object operations in `server/api/locations/[slug]/[id]/sign-images.post.ts`, `server/api/locations/[slug]/[id]/image.post.ts`, and `server/api/locations/[slug]/[id]/images/[image-id].delete.ts`.

**Testing:**
- No dedicated test runner is configured in `package.json`.
- Current automated quality gate is ESLint through `pnpm lint`.

**Build/Dev:**
- Nuxt CLI scripts: `dev`, `build`, `generate`, `preview`, `typecheck` in `package.json`.
- Drizzle Kit `^0.31.1` and `drizzle.config.ts` manage Turso migrations.
- Husky and lint-staged run `pnpm lint` before commits through `.husky/pre-commit` and `package.json`.

## Key Dependencies

**Critical:**
- `nuxt` - owns routing, SSR, API routes, app build.
- `better-auth` - owns identity and session lifecycle.
- `drizzle-orm` plus `@libsql/client` - owns database access.
- `zod` and `drizzle-zod` - owns runtime input validation.
- `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner` - owns image storage integration.
- `maplibre-gl`, `@indoorequal/vue-maplibre-gl`, `mapbox-gl` - owns maps and route visualization.
- `@sentry/nuxt` - owns client/server error reporting.

**Infrastructure:**
- `@nuxt/eslint` and `@antfu/eslint-config` - linting and format rules.
- `@tailwindcss/vite` and `daisyui` - app styling.
- `slug` and `nanoid` - location slug generation in `server/api/locations.post.ts`.

## Configuration

**Environment:**
- Environment schema is centralized in `lib/env.ts`.
- Required variable names include Turso, Better Auth, OAuth, S3, Sentry, and Mapbox settings. Do not read or quote `.env`; only the schema in `lib/env.ts` is safe to reference.
- `.env` file is present in the project root and must be treated as secret-bearing local configuration.

**Build:**
- Nuxt config: `nuxt.config.ts`.
- TypeScript config: `tsconfig.json`, `server/tsconfig.json`.
- ESLint config: `eslint.config.mjs`.
- Drizzle config: `drizzle.config.ts`.
- CI lint workflow: `.github/workflows/lint.yaml`.

## Platform Requirements

**Development:**
- Install with `pnpm install`.
- Run app with `pnpm dev`; `nuxt.config.ts` sets dev server port to 3001.
- Run local Turso/libSQL dev DB with `pnpm dev:db`, backed by `local.db`.

**Production:**
- Nuxt/Nitro build through `pnpm build`.
- Deployment artifacts and diagrams reference Vercel Edge Network in `deployment.png` and `c4_architecture.dot`, but hosting config is not encoded as a Vercel project file in this repository.

---

*Stack analysis: 2026-05-08*
