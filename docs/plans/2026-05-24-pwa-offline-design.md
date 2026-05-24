# PWA Offline Mode, Photo Queue & Push Notifications — Design

**Date:** 2026-05-24
**Status:** Approved (brainstorming complete, pending implementation plan)
**Scope:** Расширить существующий PWA-фундамент Phase 8 до полноценного offline-режима с очередью записи (фото/логи/комментарии/лайки), типизированных push-уведомлений и UI с оптимистичным состоянием.

---

## 1. Goal

Сделать WanderLog usable в реальных туристических сценариях без стабильной сети (самолёт, метро, роуминг, аэропортный captive Wi-Fi), не теряя данных пользователя при оффлайне. Включает:

1. **Прозрачный кэш просмотра** — закэшированные страницы и медиа доступны без сети.
2. **Очередь записи** — создание логов, загрузка фото, лайки и комментарии можно делать оффлайн; синхронизация автоматическая.
3. **Оптимистичный UI** — оффлайн-записи появляются в списках сразу с бейджем «pending».
4. **Типизированные push** — социальные (лайки/комментарии/ответы), статус загрузок, напоминания/системные, существующие route-generation.

Полный offline-first (двусторонний sync с conflict resolution) и нативное мобильное приложение — **out of scope**.

## 2. Decisions

| Решение | Выбор |
|---|---|
| Offline scope | Read cache + write queue (без полного offline-first) |
| Caching strategies | SWR static · NetworkFirst API · CacheFirst images |
| Cache mode | Прозрачный автокэш с LRU и size-лимитом |
| Push types | Social · Upload status · Reminders/system · (existing) Route |
| Write UX | Оптимистичный список с бейджем `Pending` |
| SW library | `@vite-pwa/nuxt` + Workbox в `injectManifest` режиме |
| Write queue | Гибрид: Workbox `BackgroundSyncPlugin` (HTTP replay) + Pinia/IDB store (UI overlay) |
| Photo queue | Blob хранится в IDB, sign выполняется в момент replay, thumbnail preview из `URL.createObjectURL` |

## 3. Architecture

```
┌─────────────────────────────── Browser tab ───────────────────────────────┐
│  Vue / Pinia                                                               │
│   ├─ stores/pending-operations  ◄── reads IDB on mount + BroadcastChannel  │
│   ├─ composables/use-network-status (onLine + heartbeat JSON probe)        │
│   ├─ composables/use-offline-queue  (enqueue / drop / retry / peek)        │
│   └─ UI overlays: OfflineBanner, PendingBadge, SyncDrawer                  │
│                                                                            │
│  IndexedDB (lib/offline/idb.ts wrapper)                                    │
│   ├─ pending_operations  (logs, comments, likes, photos)                   │
│   ├─ photo_blobs         (key=opId, value=Blob)                            │
│   └─ push_settings       (per-type opt-in flags)                           │
│                                                                            │
│  Service Worker  (public/wanderlog-sw.js, injectManifest)                  │
│   ├─ precache:  app shell + offline.html + icons                           │
│   ├─ runtime cache strategies:                                             │
│   │     NetworkFirst  → /api/* GET     + ExpirationPlugin (100 / 7d)       │
│   │     CacheFirst    → S3 images      + ExpirationPlugin (200 / 30d)      │
│   │     StaleWhileRev → /_nuxt/, fonts                                     │
│   ├─ BackgroundSyncPlugin →  /api/* POST/PUT/DELETE (queue: wl-writes)     │
│   ├─ custom Queue for photo uploads (onSync handler с re-sign)             │
│   ├─ push handler         → routes by type (social/upload/system/route)    │
│   └─ notificationclick    → focus matching client or openWindow            │
└────────────────────────────────────────────────────────────────────────────┘
                                    │ push
┌───────────────────────────────────▼────────────────────────────────────────┐
│  Server (Nitro)                                                            │
│   ├─ POST   /api/notifications/push-subscription                           │
│   ├─ DELETE /api/notifications/push-subscription/[type]                    │
│   ├─ lib/notifications/dispatch.ts   (web-push by subscription set)        │
│   ├─ server/middleware/idempotency.ts (X-Client-Op-Id dedup)               │
│   └─ event hooks in posts/comments/likes/uploads → dispatch                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Принципы
1. **Один SW, три зоны ответственности**: precache shell, runtime cache по стратегиям, BG sync write queue. Push-handler — отдельная зона, типизированная.
2. **UI знает про офлайн только через Pinia store**, не дёргает SW напрямую — SSR-friendly.
3. **Workbox делает HTTP-replay**, Pinia/IDB делают «UI-видимый pending». Дубль предотвращаем через `X-Client-Op-Id`.
4. **Push централизован**: одна таблица подписок, поле `types` (массив `social|upload|reminders|route`), сервер dispatch'ит по типу.
5. **Обратная совместимость**: текущий `route-generation` поток становится одним из типов в общей системе.

### Что НЕ делаем
- Не дублируем серверные данные в IDB полностью.
- Не используем Periodic Background Sync (плохая поддержка, требует installed PWA + engagement score).
- Не делаем CRDT/merge — write queue это конечный список операций, конфликты разрешает сервер.

## 4. Components & Files

### 4.1 Service Worker и сборка

| Файл | Действие | Что внутри |
|---|---|---|
| `nuxt.config.ts` | модификация | подключить `@vite-pwa/nuxt`, `strategies: 'injectManifest'`, `srcDir: 'public'`, `filename: 'wanderlog-sw.js'` |
| `public/wanderlog-sw.js` | переписать | Workbox-based: `precacheAndRoute(self.__WB_MANIFEST)`, 3 `registerRoute(...)` стратегии, `BackgroundSyncPlugin('wl-writes', { maxRetentionTime: 24*60 })`, существующие `push`/`notificationclick` сохранены |
| `public/route-generation-sw.js` | удалить | заменяется единым SW |
| `public/offline.html` | оставить | используется как navigation fallback |
| `package.json` | + deps | `@vite-pwa/nuxt`, `workbox-window`, `idb`, `web-push` (server-side) |

### 4.2 Клиентский offline-слой

| Файл | Тип | Назначение |
|---|---|---|
| `lib/offline/idb.ts` | new | Wrapper над `idb`: stores `pending_operations`, `photo_blobs`, `push_settings`. CRUD + миграции. |
| `lib/offline/operation-types.ts` | new | `type PendingOp = LogCreate | LogUpdate | PhotoUpload | Like | Comment`, общий `clientOpId` |
| `composables/use-network-status.ts` | new | `navigator.onLine` + heartbeat ping к `/api/health` с проверкой `content-type: application/json` (captive portal guard) |
| `composables/use-offline-queue.ts` | new | `enqueue(op)`, `drop(opId)`, `retry(opId)`, `peek()`; пишет в IDB, дублирует HTTP-вызов с `X-Client-Op-Id` |
| `composables/use-pwa-install.ts` | new | beforeinstallprompt + iOS «Add to Home Screen» onboarding |
| `stores/pending-operations.ts` | new (Pinia) | реактивный список pending ops; слушает `BroadcastChannel('wl-sync')` от SW |

### 4.3 UI overlays

| Файл | Тип | Где появляется |
|---|---|---|
| `app/components/offline/offline-banner.vue` | new | top sticky banner: «Офлайн — N операций в очереди» → drawer |
| `app/components/offline/sync-drawer.vue` | new | drawer со списком pending: превью, статус, retry/удалить |
| `app/components/offline/pending-badge.vue` | new | универсальный бейдж (часы/спиннер/восклицание) |
| `app/components/offline/queued-photo-thumb.vue` | new | reads `photo_blobs[opId]` → `URL.createObjectURL`, revoke в `onUnmounted` |
| `layouts/default.vue` | модификация | смонтировать `<OfflineBanner />` под header |
| `pages/dashboard/location/[slug]/[id]/images.vue` | модификация | offline-фоллбек на `useOfflineQueue().enqueue({type:'photo'})` |
| `app/components/feed/post-comment-form.vue` (и likes) | модификация | тот же паттерн |

### 4.4 Сервер: универсальный push + idempotency

| Файл | Действие | Что меняется |
|---|---|---|
| `lib/db/schema/push-subscription.ts` | new | таблица `push_subscription` (id, userId, endpoint UK, p256dh, auth, types JSON, userAgent, createdAt). Миграция из `route_notification_subscription` (`types=['route']`) |
| `lib/db/schema/idempotency-keys.ts` | new | таблица `idempotency_keys` (userId, clientOpId, endpoint, statusCode, responseBody, createdAt). UNIQUE(userId, clientOpId, endpoint). TTL 24ч. |
| `lib/db/queries/push-subscription.ts` | new | `upsertSubscription`, `getSubscriptionsByUserAndType`, `removeByEndpoint`, `removeByType` |
| `lib/notifications/dispatch.ts` | new | `dispatch({userId, type, payload})` → web-push по типу → удаляет 404/410 endpoints; **digest-logic** для `social.*` (мердж в счётчик при >1 событии за 10мин) |
| `server/middleware/idempotency.ts` | new | для whitelist write-endpoints: cache по `(userId, clientOpId, endpoint)`, возвращает закэшированный response при повторе |
| `server/api/notifications/push-subscription.post.ts` | new | заменяет `route-generation-subscription.post.ts` (старый → alias) |
| `server/api/notifications/push-subscription/[type].delete.ts` | new | unsubscribe по типу |
| `server/api/health.get.ts` | new | возвращает `{status:'ok'}` с `content-type: application/json` — для heartbeat |
| `server/api/posts/[id]/like.post.ts` | модификация | dispatch `social.like` |
| `server/api/posts/[id]/comments.post.ts` | модификация | dispatch `social.comment` / `social.reply` |
| `server/api/locations/.../image.post.ts` | модификация | accept `X-Client-Op-Id`, dispatch `upload.success` |

## 5. Data Flows

### 5.1 Read flow

```
Vue $fetch → SW intercept → strategy:
  NetworkFirst (api):    fetch → 200 → cache.put → return | fail → cache.match
  CacheFirst (images):   cache → hit return | miss → fetch → cache.put
  StaleWhileRev (assets): return cache + background fetch update
```
ExpirationPlugin триггерится по quota: при `QuotaExceededError` SW удаляет oldest 25%, retry put.

### 5.2 Write flow

```
useOfflineQueue.enqueue(op)
    │
    ├─► IDB pending_operations.put({opId, type, payload, status:'pending'})
    │   for photos: photo_blobs.put({opId, blob})
    ├─► Pinia store.add(op) → UI: <PendingBadge>
    └─► fetch(url, {headers:{'X-Client-Op-Id': opId}, body})
            │
            ├── online → 2xx → BroadcastChannel({opId, status:'success'})
            │                  Pinia.remove + IDB cleanup
            └── offline → SW BackgroundSyncPlugin → queue 'wl-writes'
                          → synthesized 202; status stays 'pending'

[Network returns]
SW 'sync' event → Workbox.Queue.replayRequests
    ├── 2xx → success
    ├── 401 → auth_required (НЕ удаляем); UI: «войдите чтобы синхронизировать»; после login → resume
    ├── 409 → conflict; UI: «изменено другим клиентом, заменить/отбросить»
    ├── 422 → invalid; красный бейдж + удалить операцию
    └── 5xx → exponential retry (Workbox); maxRetentionTime 24h → expired
```

**Идемпотентность**: middleware кэширует `(userId, clientOpId, endpoint) → response` на 24ч.

### 5.3 Photo upload variant

```
enqueue({type:'photo', locationLogId, blobRef:opId})
    ├── IDB.photo_blobs.put(opId, resized Blob)
    └── IDB.pending_operations.put

[replay через custom Queue.onSync]
    1. POST /api/.../sign-images  → presigned
    2. POST presigned URL with blob from IDB
    3. POST /api/.../image (with X-Client-Op-Id)
    4. on success → cleanup blob + queue
    
[edge: partial state]
    Если шаг 2 успел, шаг 3 нет → pending_operations.partial='s3-done',
    replay стартует с шага 3 (без повторного PUT в S3).
```

### 5.4 Push flow

```
Server event (like/comment/upload)
    └─► dispatch.ts
        ├─► getSubscriptionsByUserAndType(userId, 'social.like')
        ├─► digest check: >1 события за 10мин → merge в счётчик
        └─► web-push.sendNotification(sub, payload)
                │
                ▼
          SW push event
            ├── parse payload by type
            ├── rate-limit by tag (1 per 30s)
            ├── clients.matchAll: visible client on target page → postMessage in-app toast
            │                                                   else → showNotification
            └── notificationclick → focus existing or openWindow(data.url)
```

**Per-type opt-in**: первый раз user видит список (Социальные, Загрузки, Напоминания, Маршруты) с чекбоксами. Хранится в `push_subscription.types[]` + IDB `push_settings`.

**Local upload-success notifications** — из самого SW после успешного replay, без сервер-side push.

## 6. Error handling & edge cases

### 6.1 Failure map

| # | Что ломается | Где ловим | Реакция |
|---|---|---|---|
| F1 | Network исчез между шагами фото-аплоада | `useOfflineQueue` | `partial:'s3-done'`; replay стартует с confirm |
| F2 | Presigned URL истёк на replay | `Queue.onSync` photo handler | re-sign + S3 PUT заново; retry++; >5 → `expired` |
| F3 | 409 conflict | SW replay → BroadcastChannel | Drawer: «изменено другим — заменить/отбросить» |
| F4 | 422 validation | то же | `invalid` бейдж; кнопка «Удалить операцию» |
| F5 | 401 session expired | SW replay | НЕ удалять; `auth_required`; resume после login |
| F6 | IDB недоступен (Safari private, quota=0) | `idb.ts` init | Fallback: offline отключён, баннер; write требует сети |
| F7 | Quota exceeded при cache.put | SW handler | удалить oldest 25%, retry; повтор → silent skip |
| F8 | maxRetentionTime истёк | Workbox Queue | `expired`; кнопка retry форс-enqueue заново |
| F9 | Push 410 Gone | `dispatch.ts` | удалить подписку из БД |
| F10 | Permission denied | client | inline explainer, не блокируем |
| F11 | Background Sync нет (Safari) | feature detect | Fallback: `window.online` → postMessage SW `'manual-sync'` |
| F12 | SSR offline check | Pinia init | гард `if (import.meta.client)`; SSR = online |
| F13 | SW update в момент replay | `skipWaiting + clients.claim` | Workbox Queue state в IDB, переподхват без потерь |
| F14 | Двойной submit того же clientOpId | server middleware | вернуть cached response |
| F15 | Photo blob потерян | `Queue.onSync` photo | mark `corrupted`, удалить op, уведомить |

### 6.2 Реальные пользовательские сценарии

#### S1 — Captive portal (аэропорт/кафе) [SHOW-STOPPER]
`navigator.onLine === true` врёт; fetch редиректится на HTML login page; запросы возвращают 200 с HTML.

**Решение:** `useNetworkStatus` heartbeat `HEAD /api/health` с проверкой `content-type: application/json` И status. Если приходит HTML или CORS error → offline. Workbox replay тоже проверяет JSON content-type перед мерджем 2xx как success.

#### S2 — Сессия истекла пока был офлайн [SHOW-STOPPER]
3 дня в горах → 50 операций → reconnect → все 401.

**Решение:** на 401 НЕ удаляем из очереди, status=`auth_required`. Баннер «Войдите чтобы синхронизировать N записей». После login → `SW.postMessage('resume-sync')`. Better Auth сессии refreshable.

#### S3 — iOS PWA-ограничения [SHOW-STOPPER]
Push только в standalone после «Add to Home Screen»; IDB чистится через 7 дней без открытия; нет Background Sync.

**Решение:**
- onboarding-баннер «Добавьте на главный экран» для iOS Safari; без этого push кнопка disabled
- `navigator.storage.persist()` при первом enqueue + warning при отказе
- Sync trigger fallback через `window.online` (F11)

#### S4 — Двойной тап «Создать» [SHOW-STOPPER]
Пользователь не уверен что первый тап прошёл → тапает ещё раз → дубликат.

**Решение:** `enqueue` синхронный для UI — кнопка disabled в момент тапа, optimistic item до await IDB.put. `clientOpId` генерируется один раз на mount формы, обновляется только после успешного submit.

#### S5 — Long flight, 40 фото 10 логов
IDB квота: ~50MB на iOS без persist, ~1GB с persist.

**Решение:** при enqueue фото — resize до 1000px перед IDB put (как уже в текущем `images.vue`). В SyncDrawer показывать «Использовано N MB / лимит». При quota>90% — переключение на 720p или блок enqueue с предупреждением.

#### S6 — Метро / flapping connection
Replay начинается, на 2-м запросе сеть пропадает, частичные успехи.

**Решение:** debounce sync trigger в `useNetworkStatus` — ждём **3 секунды стабильного online** → только тогда триггерим. Workbox внутри делает exponential retry.

#### S7 — Stale cache после mutation
User отредактировал log online → открыл дашборд → NF cache отдаёт старую версию.

**Решение:** после успешной mutation (online или replay) — `caches.open('api-get-cache').delete(matchingURLs)`. Pinia делает invalidate при write success.

#### S8 — Дубликаты push после долгого офлайна
3 дня офлайн → 47 лайков → 47 push'ей за минуту.

**Решение:** **digest-logic в `dispatch.ts`** для `social.*`: если за последние 10 минут уже было push для `userId+postId+type` — мерджим в один «N новых лайков».

#### S9–S13 (кратко)
- **S9** Две вкладки: BroadcastChannel sync Pinia; replay делает только одна через `navigator.locks`.
- **S10** VPN с фальшивым `onLine`: покрывается S1 heartbeat.
- **S11** Incognito → IDB-per-session: warning баннер «оффлайн недоступен».
- **S12** User clears site data: `navigator.storage.persist()` + warning перед enqueue фото.
- **S13** Push когда юзер видит фид: in-app toast вместо OS-notification (через `clients.matchAll`).

### 6.3 Rate-limiting & quotas

| Что | Лимит | Где |
|---|---|---|
| Push notification per tag | 1 per 30s | SW push handler (timestamp в `caches.open('wl-meta')`) |
| Photo upload retry | max 5 attempts, exp 2^n min | `Queue.onSync` photo |
| photo_blobs quota guard | 80% storage | `navigator.storage.estimate()` перед enqueue |
| api-get-cache | 100 entries, 7 days | ExpirationPlugin |
| images-cache | 200 entries, 30 days | ExpirationPlugin |
| idempotency_keys TTL | 24h | cron cleanup |

### 6.4 Security

- `X-Client-Op-Id` принимается только для authenticated requests, middleware матчит `userId`
- Push payload не содержит секретных данных (только title/body/url)
- `push_subscription.endpoint` UNIQUE; попытка upsert чужого endpoint под другим userId → 403
- Cache user-scoped invalidation: при logout SW получает `postMessage('clear-user-cache')`, чистит api-get-cache

## 7. Testing

### 7.1 Unit (`tests/server/`)
- `idempotency-middleware.test.mjs` — повтор с тем же clientOpId, изоляция между users, TTL
- `push-subscription-api.test.mjs` — upsert с типами, миграция route-only подписок, DELETE/[type], 410 cleanup
- `push-dispatch.test.mjs` — фильтрация по типу, digest social, 410 auto-cleanup
- `idb-store.test.mjs` (jsdom) — CRUD контракт, миграции версий, quota guard
- `offline-queue-composable.test.mjs` — opId сразу, double-tap не создаёт дубликат, 401 не удаляет
- `pwa-service-worker.test.mjs` (расширить) — 3 стратегии, BackgroundSyncPlugin, push roumes by type
- `network-status.test.mjs` — captive portal detection, heartbeat debounce, 3s stability

### 7.2 SW integration (happy-dom)
- `runtime-cache.test.mjs` — NF/CF/SWR поведение, ExpirationPlugin LRU
- `background-sync.test.mjs` — failed POST → queue → replay → conflict/expired signals
- `photo-queue.test.mjs` — sign/PUT/confirm цепочка, partial state, re-sign при expired, corrupted blob
- `push-handler.test.mjs` — parsing по типам, rate-limit, in-app focus

### 7.3 Manual E2E (`tests/manual/pwa-offline-checklist.md`)

| # | Сценарий |
|---|---|
| E1 | offline.html fallback |
| E2 | online edit → offline edit → reconnect → replay |
| E3 | 3 photos offline → reconnect → все на сервере, без дублей |
| E4 | reload вкладки offline → preview из IDB работает |
| E5 | expired session offline → auth_required → resume после login |
| E6 | captive portal simulation → UI остаётся offline |
| E7 | double-tap «Создать» → один item |
| E8 | push subscribe → server trigger → OS notification → click → /feed |
| E9 | push когда вкладка /feed открыта → in-app toast |
| E10 | Lighthouse PWA ≥90 |

### 7.4 Load (опционально)
Расширить `load-e2e-social-photo.mjs` режимом `--simulate-offline-batch` — 50 фото с разными clientOpId одновременно для проверки idempotency middleware throughput.

### 7.5 Acceptance criteria
1. Все unit + SW тесты зелёные (`pnpm test:server`)
2. 10 manual E2E пройдены на Chrome desktop + Chrome Android
3. Lighthouse PWA ≥90
4. Real device тест: iPhone Safari → A2HS → offline → создать log → online → log на сервере
5. Существующий route-generation push продолжает работать (regression: `tests/server/route-generation-notifications.test.mjs`)

## 8. Out of scope

- Полный двусторонний offline-first sync с CRDT
- Native mobile app
- Periodic Background Sync (плохая поддержка)
- Offline-режим для генерации маршрутов / AI features (требует сети к LLM)
- Offline-доступ к maps tiles (Mapbox/Yandex)
- Multi-device queue sharing (queue per-device, sync per-server)

## 9. Implementation phases (suggested for /writing-plans)

1. **Foundation**: @vite-pwa/nuxt setup, переписать SW на injectManifest + Workbox, idb wrapper, network-status composable, health endpoint
2. **Read cache**: NF/CF/SWR strategies, ExpirationPlugin, cache invalidation на mutation
3. **Write queue (non-photo)**: pending_operations IDB store, idempotency middleware, BackgroundSyncPlugin, Pinia store, BroadcastChannel
4. **Photo upload queue**: photo_blobs store, custom Queue.onSync с re-sign, queued-photo-thumb component
5. **UI overlays**: OfflineBanner, SyncDrawer, PendingBadge — интеграция с pages/components
6. **Push generalization**: новая таблица + миграция, dispatch.ts, per-type opt-in UI, digest logic
7. **Push triggers**: hook social events (like/comment/reply), upload-success local notifications
8. **Edge cases hardening**: captive portal, 401 resume, iOS persist permission, double-tap prevention
9. **Testing & verification**: server tests, SW tests, manual E2E checklist, Lighthouse, real device

Phases sequential. UI overlays (phase 5) можно стартовать параллельно с phases 3-4 если структура IDB зафиксирована.
