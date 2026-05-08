# Research: Architecture

**Date:** 2026-05-08

## Target Architecture

The AI/PWA MVP should extend the current modular Nuxt monolith rather than introduce a separate service. The current codebase already has the right boundaries:

- Client UI in `pages/**` and `components/**`.
- Client state in `stores/**`.
- Server routes in `server/api/**`.
- Auth context in `server/middleware/auth.ts`.
- Database schema and queries in `lib/db/**`.
- External provider clients in `utils/**` or `lib/**`.

## Proposed AI Layers

### Data Layer

Add Drizzle tables in `lib/db/schema/ai-conversation.ts` and `lib/db/schema/ai-message.ts`.

Minimum fields:
- Conversation: `id`, `userId`, `title`, `createdAt`, `updatedAt`.
- Message: `id`, `conversationId`, `userId`, `role`, `content`, `createdAt`.

Use the existing schema barrel `lib/db/schema/index.ts` and migrations under `lib/db/migrations/**`.

### Query Layer

Add `lib/db/queries/ai-conversation.ts` for:
- Create conversation.
- Insert user message.
- Load recent conversation messages by `conversationId` and `userId`.
- Insert assistant message after stream completion.

All reads/writes must include `userId` to match existing ownership patterns.

### Server Layer

Add `server/api/ai/chat.post.ts`:
- Wrap with `defineAuthenticatedHandler`.
- Validate body with Zod.
- Persist user message.
- Load bounded context.
- Call OpenAI-compatible API with streaming enabled.
- Return stream to browser.
- Persist final assistant message once complete.

Avoid storing provider API keys in public config. Add server-only env schema entries in `lib/env.ts`.

### Client Layer

Add assistant UI under `components/ai/**` or `components/explore/**`, depending on final placement.

Use composable/store pattern:
- `stores/ai.ts` for conversations, streaming state, cancel/retry.
- `components/ai/assistant-panel.vue` for chat UI.
- `pages/explore.vue` or dashboard route embeds the assistant.

### PWA Layer

Add PWA configuration after the online AI flow works. The PWA layer should cache static app shell assets first, then selectively cache read-only API responses. Do not cache AI streaming responses as the first PWA slice.

## Architectural Constraints

- AI must be authenticated; conversation data is user-owned.
- Streaming endpoint must avoid leaking prompt content into logs.
- PWA cache must not serve stale authenticated mutations.
- Existing lint/typecheck failures must be handled before relying on CI as a green gate.
- Horizontal roadmap mode means each phase may complete a technical layer before the full end-to-end feature is ready.

## Sources

- Nuxt server directory documentation: https://nuxt.com/docs/guide/directory-structure/server
- Drizzle Turso/libSQL documentation: https://orm.drizzle.team/docs/get-started/turso-new
- Better Auth Nuxt integration: https://www.better-auth.com/docs/integrations/nuxt
- OpenAI streaming documentation: https://platform.openai.com/docs/guides/streaming-responses

---

*Research architecture notes: 2026-05-08*
