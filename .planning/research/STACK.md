# Research: Stack

**Date:** 2026-05-08

## Current Project Stack

- Nuxt 3 provides the app shell, SSR, pages, server middleware, and Nitro API routes. Current config: `nuxt.config.ts`.
- Vue 3 components and Pinia stores make up the client layer. Current examples: `components/**`, `stores/*.ts`.
- Drizzle ORM with Turso/libSQL owns persistence. Current files: `lib/db/index.ts`, `lib/db/schema/**`, `drizzle.config.ts`.
- Better Auth owns OAuth and session handling. Current files: `lib/auth.ts`, `server/api/[...auth].ts`, `server/middleware/auth.ts`.
- S3-compatible object storage is accessed with AWS SDK. Current files: `utils/create-s3-client.ts`, `server/api/locations/[slug]/[id]/sign-images.post.ts`.
- MapLibre, Mapbox GL, and Yandex Maps coexist. Current files: `lib/map/**`, `composables/useMapbox.ts`, `components/app/yndx-map.client.vue`.
- Sentry is installed and configured for Nuxt. Current files: `sentry.client.config.ts`, `sentry.server.config.ts`.

## Stack Fit For AI/PWA MVP

### Server and Streaming

Nuxt's `server/` directory maps files into Nitro server routes and middleware. This fits the planned `/api/ai/chat` endpoint because the existing project already uses Nitro handlers in `server/api/**`.

For streaming, implement the AI endpoint as a server route that returns a stream-compatible response. Keep the transport simple: browser calls the endpoint, server streams model deltas, and the server persists both user and assistant messages after the request.

### AI Provider

The current dependency list has no AI SDK or OpenAI-compatible client. For a first AI slice, use native `fetch` against an OpenAI-compatible endpoint or add an explicit SDK only after the API contract is stable. The GSD working agreement says no new dependencies without explicit request, so the initial plan should prefer native `fetch`.

### PWA

The current repository has PWA diagrams but no Nuxt PWA module, manifest, service worker source, or Workbox config. A Nuxt PWA layer should be added deliberately after the AI API/client path is stable, because offline caching and push behavior can make debugging API streaming harder.

### Testing

No test runner exists. Nuxt's ecosystem supports Vitest through Nuxt test utilities, which fits endpoint/composable tests and future UI tests. For this codebase, add tests before touching auth, upload, or streaming behavior.

## Recommended Stack Decisions

- Keep Nuxt/Nitro as the single server boundary for the AI endpoint.
- Use existing Zod validation patterns for AI request bodies.
- Add AI tables through Drizzle migrations rather than storing conversation state only in memory.
- Use native streaming primitives first; introduce a provider SDK only if it materially simplifies streaming or tool use.
- Add a Nuxt PWA layer after the AI feature has a working online path.
- Keep Sentry for AI endpoint errors, but avoid logging full prompts or model responses.

## Sources

- Nuxt server directory documentation: https://nuxt.com/docs/guide/directory-structure/server
- Nuxt testing documentation: https://nuxt.com/docs/getting-started/testing
- Drizzle Turso/libSQL documentation: https://orm.drizzle.team/docs/get-started/turso-new
- Better Auth Nuxt integration: https://www.better-auth.com/docs/integrations/nuxt
- OpenAI streaming documentation: https://platform.openai.com/docs/guides/streaming-responses
- Sentry Nuxt documentation: https://docs.sentry.io/platforms/javascript/guides/nuxt/

---

*Research stack notes: 2026-05-08*
