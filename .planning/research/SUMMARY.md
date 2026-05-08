# Research Summary

**Date:** 2026-05-08

## Stack

WanderLog should keep the current Nuxt 3/Nitro monolith and add AI/PWA capability inside the existing layer structure. Drizzle/Turso, Better Auth, S3, Pinia, and map adapters already provide the core architecture. The missing pieces are AI schema/query/API/client UI, a real streaming transport, PWA configuration/service worker behavior, and tests.

## Table Stakes

- Authenticated AI chat endpoint under `server/api/ai/**`.
- User-scoped AI conversation and message tables in `lib/db/schema/**`.
- Bounded query layer in `lib/db/queries/**`.
- Streaming response from server to browser.
- Client assistant UI with loading, streaming, retry, and error states.
- Basic route suggestion integration with Explore/map.
- PWA manifest/install/offline app-shell support.
- Tests for new schema/query/API behavior.
- Sentry-safe error handling without prompt/secret logging.

## Watch Out For

- Current diagrams show AI/SSE/PWA features that are not implemented.
- Existing lint/typecheck failures block clean verification.
- PWA caching should not cache AI streams or authenticated mutations early.
- AI endpoint must keep provider credentials server-only.
- Conversation ownership must be enforced in every query.

## Roadmap Shape

The user selected coarse granularity and Horizontal Layers. The roadmap should use 4-5 layer-oriented phases:

1. Stabilize verification foundation.
2. Add AI data model and server streaming API.
3. Add client assistant and route/map integration.
4. Add PWA shell/offline behavior.
5. Harden observability, security, and deployment readiness.

## Sources

- Nuxt server directory documentation: https://nuxt.com/docs/guide/directory-structure/server
- Nuxt testing documentation: https://nuxt.com/docs/getting-started/testing
- Drizzle Turso/libSQL documentation: https://orm.drizzle.team/docs/get-started/turso-new
- Better Auth Nuxt integration: https://www.better-auth.com/docs/integrations/nuxt
- OpenAI streaming documentation: https://platform.openai.com/docs/guides/streaming-responses
- Sentry Nuxt documentation: https://docs.sentry.io/platforms/javascript/guides/nuxt/
- Existing codebase map: `.planning/codebase/*.md`

---

*Research summary: 2026-05-08*
