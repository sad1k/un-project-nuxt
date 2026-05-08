# Research: Pitfalls

**Date:** 2026-05-08

## AI Streaming Pitfalls

- Do not mix planned diagram claims with implemented code. Current source has no `/api/ai/chat`.
- Do not expose AI provider keys through `runtimeConfig.public`.
- Do not log full prompts, model responses, or provider headers.
- Do not persist assistant messages before stream completion unless partial-message recovery is intentionally designed.
- Do not let users read or append to conversations without checking `userId`.
- Do not make the streaming endpoint depend on browser-only APIs.

## PWA Pitfalls

- Do not cache authenticated mutating API requests.
- Do not cache AI streaming responses in the first PWA slice.
- Do not claim push notifications until a notification permission flow, server subscription storage, and delivery provider are implemented.
- Do not rely on service worker behavior without browser verification.
- Do not hide offline failures; users need clear offline/read-only states.

## Nuxt/Nitro Pitfalls

- `lib/env.ts` parses env variables at import time, so adding AI env vars can break unrelated scripts if not handled carefully.
- Existing `server/middleware/auth.ts` must run before authenticated handlers depend on `event.context.user`.
- Current lint/typecheck failures mean adding new files can be hard to verify until baseline issues are resolved or scoped checks are used.

## Data Pitfalls

- Conversation/message tables should cascade with user deletion.
- Message content can grow quickly; consider max prompt/message length at API validation.
- Context loading must be bounded to avoid large prompt payloads.
- Route suggestions should be structured explicitly if the map will consume them.

## Current Codebase Pitfalls From Map

- No automated tests exist.
- Console logging remains in runtime paths.
- Some Russian user-facing strings appear mojibake in source output.
- Feed post creation may not verify image ownership.
- S3 delete flow can remove DB metadata before object deletion succeeds.

## Sources

- Nuxt testing documentation: https://nuxt.com/docs/getting-started/testing
- OpenAI streaming documentation: https://platform.openai.com/docs/guides/streaming-responses
- Sentry Nuxt documentation: https://docs.sentry.io/platforms/javascript/guides/nuxt/
- Existing map: `.planning/codebase/CONCERNS.md`

---

*Research pitfall notes: 2026-05-08*
