# Research Summary

**Date:** 2026-05-08

## Stack

WanderLog should keep the current Nuxt 3/Nitro monolith and add the fully working Explore page inside the existing layer structure. Drizzle/Turso, Better Auth, S3, Pinia, and map adapters already provide the core architecture. The missing pieces are Explore inputs, AI schema/query/API/client UI, a real streaming transport, animated map route rendering, place intelligence, weather tips, save-to-diary flow, PWA configuration/service worker behavior, and tests.

## Table Stakes

- Authenticated AI chat endpoint under `server/api/ai/**`.
- City autocomplete, days, interests, filters, current location, saved places, and diary context on Explore.
- User-scoped AI conversation and message tables in `lib/db/schema/**`.
- Bounded query layer in `lib/db/queries/**`.
- Streaming response from server to browser.
- Client assistant UI with loading, streaming, retry, and error states.
- Basic route suggestion integration with Explore/map.
- Animated route markers, route line, day-by-day route grouping, distances, and saved places.
- Place popup with info, pictures, reviews/rating, estimated cost, and community visit signals when data exists.
- Weather-correlated route tips about what the user should take.
- Save generated route or selected places into diary.
- PWA manifest/install/offline app-shell support.
- Tests for new schema/query/API behavior.
- Sentry-safe error handling without prompt/secret logging.

## Watch Out For

- Current diagrams show AI/SSE/PWA features that are not implemented.
- `components/explore/` is a template of the desired direction, not an exact final UI.
- Existing lint/typecheck failures block clean verification.
- PWA caching should not cache AI streams or authenticated mutations early.
- AI endpoint must keep provider credentials server-only.
- Conversation ownership must be enforced in every query.
- Community "users there now" signals must be app-data-based or clearly estimated; do not fabricate live presence.

## Roadmap Shape

The user selected coarse granularity and Horizontal Layers. After the Explore scope update, the roadmap should use 6 layer-oriented phases:

1. Lock Explore scope and verification foundation.
2. Add Explore input/context layer.
3. Add AI route generation and streaming.
4. Add animated map route experience.
5. Add place intelligence and weather tips.
6. Add save-to-diary flow and release hardening.

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
