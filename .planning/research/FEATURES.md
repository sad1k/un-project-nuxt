# Research: Features

**Date:** 2026-05-08

## Existing Product Capabilities

### Travel Journal

- User can authenticate with OAuth providers through Better Auth.
- User can manage locations and location logs.
- User can attach images to location logs through S3-compatible upload flow.
- User can view map markers and location navigation.

### Social Feed

- User can publish a location-log image as a post.
- User can view feed items with image, caption, counts, and user data.
- User can like/unlike posts optimistically.
- User can comment on posts and delete own comments.

### Explore Prototype

- User can enter a destination-like flow that generates hard-coded route points.
- Current route generation is local mock data in `composables/useRouteGenerator.ts`.

## v1 AI/PWA Feature Categories

### AI Conversation

Table stakes:
- User can send a travel planning prompt to an AI assistant.
- User sees streamed answer chunks while generation is in progress.
- User can recover gracefully when generation fails.
- User prompt and final assistant answer are persisted.

Differentiators:
- Assistant can reference existing locations, logs, and images as context.
- Assistant can produce route points that appear on the map.
- Assistant can continue a previous conversation.

### AI Data Model

Table stakes:
- Database stores conversations and messages.
- Messages are scoped to the authenticated user.
- Request/response metadata avoids storing secrets.

Differentiators:
- Conversation can link to generated/saved routes.
- User can convert assistant route suggestions into location logs.

### Client AI Experience

Table stakes:
- Chat or assistant panel is available from Explore or dashboard.
- Streaming state is visible.
- User can cancel or retry a request.

Differentiators:
- Route points are drawn live on the existing Mapbox/MapLibre map.
- Assistant output includes structured itinerary cards.

### PWA

Table stakes:
- Web app has a manifest and install metadata.
- Static app shell and critical assets are cached.
- Offline state is clear and non-destructive.

Differentiators:
- Recent travel logs/images metadata are available offline.
- Push notifications are supported.

### Quality and Safety

Table stakes:
- Lint/typecheck baseline is understood.
- Critical new endpoints have tests.
- AI and PWA behaviors have manual verification steps.

Differentiators:
- Streaming endpoint has integration tests.
- PWA caching strategy is tested in browser.

## Feature Boundaries For v1

Include in v1:
- Authenticated AI chat endpoint.
- Streaming AI response path.
- Conversation/message persistence.
- Basic client assistant UI.
- Route suggestion integration with the existing Explore/map prototype.
- PWA install/offline app-shell support.
- Tests for new AI data/API behavior.

Defer to v2:
- Push notifications.
- Full RAG over images and all location history.
- Multi-provider AI model configuration UI.
- Admin moderation for AI content.
- Full offline editing/sync conflict resolution.

## Sources

- Nuxt server directory documentation: https://nuxt.com/docs/guide/directory-structure/server
- OpenAI streaming documentation: https://platform.openai.com/docs/guides/streaming-responses
- Nuxt testing documentation: https://nuxt.com/docs/getting-started/testing
- Nuxt module ecosystem for PWA: https://nuxt.com/modules

---

*Research feature notes: 2026-05-08*
