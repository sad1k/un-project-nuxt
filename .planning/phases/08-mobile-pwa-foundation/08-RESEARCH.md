# Phase 8: Mobile PWA Foundation - Research

## Scope

Phase 8 establishes WanderLog's mobile PWA foundation after the Explore route loop and advanced place-story work. The phase should make the app installable, define one coherent service-worker boundary, provide a safe offline shell, preserve existing route-generation push notification behavior, and add mobile verification without expanding into native mobile or full offline editing/sync.

## Current Codebase Findings

- `nuxt.config.ts` has no PWA module and no app-level manifest metadata.
- `public/route-generation-sw.js` exists and is intentionally notification-scoped: it handles `push` and `notificationclick` only.
- `composables/use-route-generation-notifications.ts` registers `/route-generation-sw.js` only when browser notification permission, service worker support, PushManager support, and a public VAPID key are present.
- `composables/use-place-story.ts` already uses the browser Cache API for explicit saved-audio offline playback. That cache is not service-worker managed and should remain explicit user action, not automatic broad precaching.
- `tests/server/route-generation-notifications.test.mjs` and `tests/server/place-story-offline.test.mjs` protect the current push/offline boundaries.
- `.planning/PROJECT.md` marks full offline editing/sync and native mobile app as out of scope; Phase 8 must preserve that boundary.

## External Reference Findings

- MDN describes a web app manifest as the browser-facing JSON file used to provide install information such as name and icon. It is linked from the document head with `rel="manifest"`.
- MDN describes service workers as browser-network proxies used for offline experiences, request interception, asset updates, push notifications, and related background APIs.
- `@vite-pwa/nuxt` is the official Vite PWA Nuxt integration path and can inject a manifest link plus `$pwa` helpers, but it requires adding `@vite-pwa/nuxt` as a dependency/module.

References:
- MDN Web App Manifest: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- MDN Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- Vite PWA Nuxt 3 integration: https://vite-pwa-org.netlify.app/frameworks/nuxt.html

## Recommended Architecture

Use a dependency-free first slice:

1. Add a static `public/manifest.webmanifest`, install icons, and app head links/meta from `app.vue` or Nuxt config.
2. Replace the notification-only service worker registration path with a single app service worker, for example `/wanderlog-sw.js`, that:
   - retains `push` and `notificationclick` behavior,
   - handles only safe navigation/app-shell fallback caching,
   - excludes API requests, authenticated data, map tiles, S3 assets, provider responses, and story audio from broad runtime caching,
   - serves an offline fallback page for navigation when no network is available.
3. Keep explicit Cache API audio saving in `use-place-story.ts`; do not move it into broad service-worker fetch caching.
4. Add a lightweight install/update/mobile status surface in the app shell, plus source tests and a manual mobile/PWA verification checklist.

## Rejected or Deferred

- Adding `@vite-pwa/nuxt` now: useful later, but it adds a new dependency and overlaps with the existing hand-written service-worker notification path. Phase 8 can get the foundation working without it.
- Workbox-generated precache: deferred because the app already has custom push and explicit audio cache behavior, and a broad generated precache could accidentally cache private/authenticated or provider content.
- Full offline diary editing/sync: explicitly out of scope in PROJECT/REQUIREMENTS because conflict resolution and durable local write queues are larger than a foundation phase.
- Native mobile app: explicitly out of scope; this phase is web/PWA only.

## Planning Recommendation

Create three plans:

1. Installability and manifest foundation.
2. Unified service worker and safe offline shell.
3. Mobile install/update UX and verification hardening.

The plans should be sequential. The manifest should land before service-worker UX, and the unified service worker should land before mobile verification/UI claims that the PWA shell is ready.

---

*Phase: 08-mobile-pwa-foundation*
*Research completed: 2026-05-18*
