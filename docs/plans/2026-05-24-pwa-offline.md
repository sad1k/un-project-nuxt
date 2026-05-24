# PWA Offline, Photo Queue & Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Расширить существующий PWA-фундамент WanderLog до прозрачного offline-режима с очередью записи (логи/фото/лайки/комментарии), универсальной системы push-уведомлений по типам и оптимистичного UI с pending-бейджами.

**Architecture:** `@vite-pwa/nuxt` в `injectManifest` режиме объединяет Workbox (precache + runtime strategies + BackgroundSyncPlugin) и существующий handcrafted push handler. Клиент держит тонкую IDB-таблицу `pending_operations` (+ blob storage для фото); UI слой читает её через Pinia store. Идемпотентность HTTP-replay обеспечивается middleware по `X-Client-Op-Id` header. Push generalизуется в одну `push_subscription` таблицу с `types[]` массивом, dispatch'ится из сервер-сайд хуков на social events.

**Tech Stack:** Nuxt 3, Vue 3, Pinia, Workbox 7 (`workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-background-sync`, `workbox-expiration`), `@vite-pwa/nuxt`, `idb` 8.x (IDB promise wrapper), `web-push` (Node web push library), Better Auth, Drizzle ORM, Turso (libsql).

**Reference:** [docs/plans/2026-05-24-pwa-offline-design.md](docs/plans/2026-05-24-pwa-offline-design.md)

---

## Pre-flight

**Step 0.1: Confirm worktree state.**

Run: `git status && git log --oneline -3`

Expected: branch `claude/trusting-feynman-6874e2`, latest commit `ae769f1` (design doc).

**Step 0.2: Install dependencies.**

Run: `pnpm install --ignore-scripts`

Expected: clean install. `nuxt prepare` skipped because env vars not required for the file-based work in this plan.

**Step 0.3: Verify existing PWA tests still pass.**

Run: `node scripts/run-node-tests.mjs tests/server/pwa-service-worker.test.mjs tests/server/pwa-installability.test.mjs tests/server/route-generation-notifications.test.mjs tests/server/place-story-offline.test.mjs`

Expected: all green. These are regression guards — must stay green through every phase.

**Step 0.4: Verify dev server boots.**

Run: `pnpm dev` (Ctrl+C after `Listening on http://localhost:3001`).

Expected: dev server starts on port 3001 without errors.

---

# PHASE 1 — Foundation

Goal: Replace handwritten SW with Workbox via `@vite-pwa/nuxt` `injectManifest` mode without changing any user-visible behavior. Add the IDB wrapper, network-status composable, health endpoint, and idempotency middleware skeleton.

## Task 1: Add @vite-pwa/nuxt + Workbox dependencies

**Files:**
- Modify: [package.json](package.json)

**Step 1.1: Add dev/runtime dependencies.**

Run:
```
pnpm add @vite-pwa/nuxt workbox-window idb
pnpm add -D workbox-precaching workbox-routing workbox-strategies workbox-background-sync workbox-expiration workbox-broadcast-update
```

Expected: packages added to `package.json` dependencies and devDependencies; `pnpm-lock.yaml` updated.

**Step 1.2: Commit.**

```
git add package.json pnpm-lock.yaml
git commit -m "feat(pwa): add @vite-pwa/nuxt + workbox + idb deps"
```

## Task 2: Wire @vite-pwa/nuxt module with injectManifest

**Files:**
- Modify: [nuxt.config.ts](nuxt.config.ts)
- Test: [tests/server/pwa-installability.test.mjs](tests/server/pwa-installability.test.mjs) (existing — used as regression guard)

**Step 2.1: Add `@vite-pwa/nuxt` to modules array and configure.**

In [nuxt.config.ts](nuxt.config.ts), append to `modules` array:

```ts
"@vite-pwa/nuxt",
```

After the `sentry` block, add:

```ts
pwa: {
  registerType: "autoUpdate",
  strategies: "injectManifest",
  srcDir: "public",
  filename: "wanderlog-sw.js",
  injectManifest: {
    globPatterns: [
      "**/*.{js,css,html,svg,png,ico,webmanifest}",
    ],
    globIgnores: [
      "**/sw.js",
      "**/wanderlog-sw.js",
      "**/route-generation-sw.js",
    ],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
  manifest: false,
  devOptions: {
    enabled: false,
  },
  client: {
    installPrompt: false,
  },
},
```

Notes:
- `manifest: false` because we keep our handwritten [public/manifest.webmanifest](public/manifest.webmanifest) (it has screenshots config the plugin would override).
- `devOptions.enabled: false` to avoid double SW registration during `pnpm dev` (we use the production registration path).
- `installPrompt: false` because we'll add a custom `use-pwa-install.ts` composable later.

**Step 2.2: Run regression tests.**

Run: `node scripts/run-node-tests.mjs tests/server/pwa-installability.test.mjs tests/server/pwa-service-worker.test.mjs`

Expected: all green (we haven't touched the SW yet, just wired the build).

**Step 2.3: Commit.**

```
git add nuxt.config.ts
git commit -m "feat(pwa): wire @vite-pwa/nuxt in injectManifest mode"
```

## Task 3: Rewrite wanderlog-sw.js on Workbox primitives (preserve push handlers)

**Files:**
- Modify: [public/wanderlog-sw.js](public/wanderlog-sw.js)
- Delete: [public/route-generation-sw.js](public/route-generation-sw.js) (it's just `importScripts` of wanderlog-sw.js — fully redundant after the rewrite)
- Test: [tests/server/pwa-service-worker.test.mjs](tests/server/pwa-service-worker.test.mjs) (update assertions)

**Step 3.1: Write failing test additions.**

In [tests/server/pwa-service-worker.test.mjs](tests/server/pwa-service-worker.test.mjs), add at the bottom of the describe block:

```js
it("imports workbox primitives", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("workbox-precaching"));
  assert.ok(sw.includes("workbox-routing"));
  assert.ok(sw.includes("workbox-strategies"));
  assert.ok(sw.includes("workbox-background-sync"));
  assert.ok(sw.includes("workbox-expiration"));
});

it("precaches __WB_MANIFEST", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("self.__WB_MANIFEST"));
  assert.ok(sw.includes("precacheAndRoute"));
});

it("registers NetworkFirst route for /api/ GET", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("NetworkFirst"));
  assert.ok(/registerRoute\([^)]*\/api\//.test(sw));
});

it("registers CacheFirst route for image hosts", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("CacheFirst"));
});

it("registers StaleWhileRevalidate for nuxt assets", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("StaleWhileRevalidate"));
  assert.ok(sw.includes("/_nuxt/"));
});

it("uses BackgroundSyncPlugin with queue name wl-writes", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("BackgroundSyncPlugin"));
  assert.ok(sw.includes("wl-writes"));
});

it("preserves existing push handler", async () => {
  const sw = await readFile(swPath, "utf8");
  assert.ok(sw.includes("addEventListener(\"push\""));
  assert.ok(sw.includes("notificationclick"));
});
```

**Step 3.2: Run tests to verify they fail.**

Run: `node scripts/run-node-tests.mjs tests/server/pwa-service-worker.test.mjs`

Expected: FAIL — new assertions can't find workbox imports.

**Step 3.3: Rewrite SW.**

Replace [public/wanderlog-sw.js](public/wanderlog-sw.js) entirely with:

```js
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";

const OFFLINE_URL = "/offline.html";

// 1) Precache app shell (injected by build via injectManifest)
precacheAndRoute(self.__WB_MANIFEST || []);

// 2) Runtime caches
// 2a) Nuxt static assets: SWR with no expiration limits (build-time hashed)
registerRoute(
  ({ url }) => url.pathname.startsWith("/_nuxt/")
    || url.pathname.startsWith("/icons/")
    || url.pathname.startsWith("/screenshots/"),
  new StaleWhileRevalidate({ cacheName: "wl-static-v1" }),
);

// 2b) Images: CacheFirst with LRU
registerRoute(
  ({ request, url }) => request.destination === "image"
    || /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: "wl-images-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// 2c) API GET: NetworkFirst with cache fallback + LRU
registerRoute(
  ({ url, request }) => request.method === "GET"
    && url.pathname.startsWith("/api/")
    && !url.pathname.startsWith("/api/auth")
    && !url.pathname.startsWith("/api/explore/place-story/audio")
    && !url.pathname.startsWith("/api/health"),
  new NetworkFirst({
    cacheName: "wl-api-v1",
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// 3) Write queue: BackgroundSyncPlugin for non-photo mutations
const writeQueuePlugin = new BackgroundSyncPlugin("wl-writes", {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
          // Auth errors keep the request in the queue
          if (response.status === 401) {
            await queue.unshiftRequest(entry);
            broadcastSync({ status: "auth_required", opId: entry.metadata?.opId });
            break;
          }
          if (response.status === 409) {
            broadcastSync({ status: "conflict", opId: entry.metadata?.opId });
            continue;
          }
          if (response.status === 422) {
            broadcastSync({ status: "invalid", opId: entry.metadata?.opId });
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        broadcastSync({ status: "success", opId: entry.metadata?.opId });
      }
      catch (err) {
        await queue.unshiftRequest(entry);
        throw err;
      }
    }
  },
});

// Match all mutating /api/ requests EXCEPT photo upload (custom queue handles it)
registerRoute(
  ({ url, request }) => (request.method === "POST" || request.method === "PUT" || request.method === "DELETE")
    && url.pathname.startsWith("/api/")
    && !url.pathname.includes("/sign-images")
    && !url.pathname.includes("/api/auth"),
  async ({ event }) => {
    try {
      return await fetch(event.request.clone());
    }
    catch {
      await writeQueuePlugin.fetchDidFail({ request: event.request });
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  // applies to all methods (workbox-routing accepts string or array)
  "POST",
);
registerRoute(/.*\/api\//, () => fetch.bind(self), "PUT");
registerRoute(/.*\/api\//, () => fetch.bind(self), "DELETE");

// 4) Navigation fallback to /offline.html
registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      return await fetch(event.request);
    }
    catch {
      const cache = await caches.open("wl-static-v1");
      const cached = await cache.match(OFFLINE_URL);
      return cached || Response.error();
    }
  },
);

// 5) Push handlers (preserved from original SW)
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  }
  catch {
    payload = {};
  }

  const title = payload.title || "WanderLog";
  const tag = payload.tag || (payload.type ? `${payload.type}:${payload.id || Date.now()}` : "wanderlog");

  const options = {
    body: payload.body || "",
    data: {
      type: payload.type,
      url: payload.url || "/",
      ...payload.data,
    },
    icon: "/icons/wanderlog-icon-192.png",
    tag,
    renotify: false,
  };

  event.waitUntil((async () => {
    if (await shouldShowInAppToast(payload)) {
      return;
    }
    return self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    const existingClient = windows.find(client => client.url === targetUrl);
    if (existingClient) {
      return existingClient.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

// 6) Manual sync trigger (Safari fallback — no Background Sync API)
self.addEventListener("message", async (event) => {
  if (event.data?.type === "wl-manual-sync") {
    await self.registration.sync?.register("wl-writes").catch(() => {});
  }
  if (event.data?.type === "wl-clear-user-cache") {
    await caches.delete("wl-api-v1");
  }
});

// 7) Activate: claim clients and clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const expectedCaches = new Set(["wl-static-v1", "wl-images-v1", "wl-api-v1"]);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("wl-") && !expectedCaches.has(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function broadcastSync(message) {
  const channel = new BroadcastChannel("wl-sync");
  try {
    channel.postMessage(message);
  }
  finally {
    channel.close();
  }
}

async function shouldShowInAppToast(payload) {
  if (!payload?.type?.startsWith("social.")) {
    return false;
  }
  const windows = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  const focused = windows.find(client => client.focused && client.url.includes("/feed"));
  if (!focused) {
    return false;
  }
  focused.postMessage({ type: "wl-in-app-toast", payload });
  return true;
}
```

**Step 3.4: Delete the redundant route-generation SW shim.**

Run: `git rm public/route-generation-sw.js`

**Step 3.5: Update tests to pass.**

Run: `node scripts/run-node-tests.mjs tests/server/pwa-service-worker.test.mjs`

Expected: PASS for the new assertions. If existing assertions about specific old strings fail, update them in the same edit to reflect the new SW (search for `wanderlog-app-shell` and other v1 references — these change to `wl-*-v1`).

**Step 3.6: Update registration in `use-route-generation-notifications.ts`.**

In [composables/use-route-generation-notifications.ts:84](composables/use-route-generation-notifications.ts:84), the line registering `/wanderlog-sw.js` stays the same (we keep the filename). Verify no other code references `/route-generation-sw.js`:

Run: `grep -r "route-generation-sw" .` (use Grep tool, not bash grep).

Expected: zero matches after the rm.

**Step 3.7: Smoke test dev server.**

Run: `pnpm dev` in background, then verify:
- `curl -s http://localhost:3001/wanderlog-sw.js | head -5` shows the new Workbox-based SW
- Ctrl+C the dev server

**Step 3.8: Commit.**

```
git add public/wanderlog-sw.js tests/server/pwa-service-worker.test.mjs
git rm public/route-generation-sw.js
git commit -m "feat(pwa): rewrite service worker on workbox primitives"
```

## Task 4: Add IDB wrapper (`lib/offline/idb.ts`)

**Files:**
- Create: [lib/offline/idb.ts](lib/offline/idb.ts)
- Create: [lib/offline/operation-types.ts](lib/offline/operation-types.ts)
- Create: [tests/server/idb-store.test.mjs](tests/server/idb-store.test.mjs)

**Step 4.1: Define operation types.**

Create [lib/offline/operation-types.ts](lib/offline/operation-types.ts):

```ts
export type PendingStatus = "pending" | "auth_required" | "conflict" | "invalid" | "expired" | "corrupted";

export type LogCreateOp = {
  type: "log.create";
  payload: { locationSlug: string; name: string; description?: string; lat?: number; long?: number; startedAt?: number; endedAt?: number };
};

export type LogUpdateOp = {
  type: "log.update";
  payload: { locationSlug: string; logId: number; name?: string; description?: string; startedAt?: number; endedAt?: number };
};

export type PhotoUploadOp = {
  type: "photo.upload";
  payload: { locationSlug: string; logId: number; blobRef: string; mimeType: string; checksum: string; partial?: "s3-done" };
};

export type LikeOp = {
  type: "post.like";
  payload: { postId: number; action: "like" | "unlike" };
};

export type CommentOp = {
  type: "post.comment";
  payload: { postId: number; content: string; parentId?: number; replyToUserId?: number };
};

export type PendingOpKind = LogCreateOp | LogUpdateOp | PhotoUploadOp | LikeOp | CommentOp;

export type PendingOp = PendingOpKind & {
  opId: string;
  status: PendingStatus;
  createdAt: number;
  updatedAt: number;
  retries: number;
  lastError?: string;
};

export type PushSettings = {
  social: boolean;
  upload: boolean;
  reminders: boolean;
  route: boolean;
};
```

**Step 4.2: Write failing IDB tests.**

Create [tests/server/idb-store.test.mjs](tests/server/idb-store.test.mjs):

```js
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Use fake-indexeddb to emulate IDB in Node
import "fake-indexeddb/auto";
import { openWanderlogDB, putOperation, listOperations, removeOperation, getOperation, putPhotoBlob, getPhotoBlob, deletePhotoBlob } from "../../lib/offline/idb.ts";

describe("offline IDB store", () => {
  beforeEach(async () => {
    // Reset IDB between tests
    indexedDB.deleteDatabase("wanderlog");
  });

  it("opens database with expected stores", async () => {
    const db = await openWanderlogDB();
    assert.ok(db.objectStoreNames.contains("pending_operations"));
    assert.ok(db.objectStoreNames.contains("photo_blobs"));
    assert.ok(db.objectStoreNames.contains("push_settings"));
    db.close();
  });

  it("puts and lists pending operations", async () => {
    await putOperation({
      opId: "op1",
      type: "post.like",
      payload: { postId: 1, action: "like" },
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retries: 0,
    });
    const ops = await listOperations();
    assert.equal(ops.length, 1);
    assert.equal(ops[0].opId, "op1");
  });

  it("removes operation by opId", async () => {
    await putOperation({ opId: "op2", type: "post.like", payload: { postId: 1, action: "like" }, status: "pending", createdAt: 1, updatedAt: 1, retries: 0 });
    await removeOperation("op2");
    const op = await getOperation("op2");
    assert.equal(op, undefined);
  });

  it("stores and retrieves blob", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    await putPhotoBlob("blob1", blob);
    const retrieved = await getPhotoBlob("blob1");
    assert.ok(retrieved instanceof Blob);
    assert.equal(retrieved.size, 5);
  });

  it("deletes blob", async () => {
    const blob = new Blob(["x"]);
    await putPhotoBlob("blob2", blob);
    await deletePhotoBlob("blob2");
    const retrieved = await getPhotoBlob("blob2");
    assert.equal(retrieved, undefined);
  });
});
```

Add `fake-indexeddb` as dev dep:
```
pnpm add -D fake-indexeddb
```

**Step 4.3: Run tests to verify they fail.**

Run: `node scripts/run-node-tests.mjs tests/server/idb-store.test.mjs`

Expected: FAIL (`lib/offline/idb.ts` doesn't exist).

**Step 4.4: Implement IDB wrapper.**

Create [lib/offline/idb.ts](lib/offline/idb.ts):

```ts
import { type IDBPDatabase, openDB } from "idb";
import type { PendingOp, PushSettings } from "./operation-types";

const DB_NAME = "wanderlog";
const DB_VERSION = 1;

type WLSchema = {
  pending_operations: { key: string; value: PendingOp; indexes: { byCreatedAt: number; byStatus: string } };
  photo_blobs: { key: string; value: Blob };
  push_settings: { key: "settings"; value: PushSettings };
};

let dbPromise: Promise<IDBPDatabase<WLSchema>> | null = null;

export function openWanderlogDB() {
  if (!dbPromise) {
    dbPromise = openDB<WLSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending_operations")) {
          const store = db.createObjectStore("pending_operations", { keyPath: "opId" });
          store.createIndex("byCreatedAt", "createdAt");
          store.createIndex("byStatus", "status");
        }
        if (!db.objectStoreNames.contains("photo_blobs")) {
          db.createObjectStore("photo_blobs");
        }
        if (!db.objectStoreNames.contains("push_settings")) {
          db.createObjectStore("push_settings");
        }
      },
    });
  }
  return dbPromise;
}

export async function putOperation(op: PendingOp) {
  const db = await openWanderlogDB();
  await db.put("pending_operations", op);
}

export async function listOperations(): Promise<PendingOp[]> {
  const db = await openWanderlogDB();
  return db.getAllFromIndex("pending_operations", "byCreatedAt");
}

export async function getOperation(opId: string): Promise<PendingOp | undefined> {
  const db = await openWanderlogDB();
  return db.get("pending_operations", opId);
}

export async function removeOperation(opId: string) {
  const db = await openWanderlogDB();
  await db.delete("pending_operations", opId);
}

export async function updateOperationStatus(opId: string, patch: Partial<PendingOp>) {
  const db = await openWanderlogDB();
  const existing = await db.get("pending_operations", opId);
  if (!existing) return;
  await db.put("pending_operations", { ...existing, ...patch, updatedAt: Date.now() });
}

export async function putPhotoBlob(opId: string, blob: Blob) {
  const db = await openWanderlogDB();
  await db.put("photo_blobs", blob, opId);
}

export async function getPhotoBlob(opId: string): Promise<Blob | undefined> {
  const db = await openWanderlogDB();
  return db.get("photo_blobs", opId);
}

export async function deletePhotoBlob(opId: string) {
  const db = await openWanderlogDB();
  await db.delete("photo_blobs", opId);
}

export async function getPushSettings(): Promise<PushSettings | undefined> {
  const db = await openWanderlogDB();
  return db.get("push_settings", "settings");
}

export async function setPushSettings(settings: PushSettings) {
  const db = await openWanderlogDB();
  await db.put("push_settings", settings, "settings");
}

export async function estimateStorageUsage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, ratio: 0 };
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}
```

**Step 4.5: Run tests to verify pass.**

Run: `node scripts/run-node-tests.mjs tests/server/idb-store.test.mjs`

Expected: 5 tests PASS.

**Step 4.6: Commit.**

```
git add lib/offline/idb.ts lib/offline/operation-types.ts tests/server/idb-store.test.mjs package.json pnpm-lock.yaml
git commit -m "feat(offline): add idb wrapper + operation types"
```

## Task 5: Add /api/health endpoint for captive-portal detection

**Files:**
- Create: [server/api/health.get.ts](server/api/health.get.ts)
- Create: [tests/server/health-endpoint.test.mjs](tests/server/health-endpoint.test.mjs)

**Step 5.1: Write failing test.**

Create [tests/server/health-endpoint.test.mjs](tests/server/health-endpoint.test.mjs):

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import handler from "../../server/api/health.get.ts";

describe("GET /api/health", () => {
  it("returns ok with content-type application/json", async () => {
    const event = {
      node: { res: { setHeader: () => {} } },
      context: {},
    };
    const response = await handler(event);
    assert.deepEqual(response, { status: "ok" });
  });
});
```

**Step 5.2: Run test to verify fail.**

Run: `node scripts/run-node-tests.mjs tests/server/health-endpoint.test.mjs`

Expected: FAIL (file doesn't exist).

**Step 5.3: Implement endpoint.**

Create [server/api/health.get.ts](server/api/health.get.ts):

```ts
export default defineEventHandler(() => {
  return { status: "ok", timestamp: Date.now() };
});
```

**Step 5.4: Run test to verify pass.**

Run: `node scripts/run-node-tests.mjs tests/server/health-endpoint.test.mjs`

Expected: PASS.

**Step 5.5: Commit.**

```
git add server/api/health.get.ts tests/server/health-endpoint.test.mjs
git commit -m "feat(offline): add /api/health endpoint for heartbeat"
```

## Task 6: Add useNetworkStatus composable

**Files:**
- Create: [composables/use-network-status.ts](composables/use-network-status.ts)
- Create: [tests/server/use-network-status.test.mjs](tests/server/use-network-status.test.mjs)

**Step 6.1: Write failing test.**

Create [tests/server/use-network-status.test.mjs](tests/server/use-network-status.test.mjs):

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretHeartbeat } from "../../composables/use-network-status.ts";

describe("interpretHeartbeat", () => {
  it("returns online for json 200", () => {
    assert.equal(interpretHeartbeat({ ok: true, status: 200, contentType: "application/json" }), "online");
  });

  it("returns captive_portal for html 200 (Wi-Fi login page)", () => {
    assert.equal(interpretHeartbeat({ ok: true, status: 200, contentType: "text/html" }), "captive_portal");
  });

  it("returns offline for thrown error", () => {
    assert.equal(interpretHeartbeat({ ok: false, status: 0, contentType: null, error: true }), "offline");
  });

  it("treats 5xx as offline (server down counts as no service)", () => {
    assert.equal(interpretHeartbeat({ ok: false, status: 503, contentType: "application/json" }), "offline");
  });
});
```

**Step 6.2: Run test to verify fail.**

Expected: FAIL.

**Step 6.3: Implement composable.**

Create [composables/use-network-status.ts](composables/use-network-status.ts):

```ts
type HeartbeatResult = "online" | "offline" | "captive_portal";

type HeartbeatInput = {
  ok: boolean;
  status: number;
  contentType: string | null;
  error?: boolean;
};

export function interpretHeartbeat(input: HeartbeatInput): HeartbeatResult {
  if (input.error || input.status === 0) return "offline";
  if (input.status >= 500) return "offline";
  if (!input.ok) return "offline";
  if (input.contentType && input.contentType.includes("application/json")) return "online";
  if (input.contentType && input.contentType.includes("text/html")) return "captive_portal";
  return "offline";
}

const status = ref<HeartbeatResult>("online");
const lastChange = ref(Date.now());
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let stabilityTimer: ReturnType<typeof setTimeout> | null = null;

async function probe(): Promise<HeartbeatResult> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/health", {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    return interpretHeartbeat({
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
    });
  }
  catch {
    return interpretHeartbeat({ ok: false, status: 0, contentType: null, error: true });
  }
}

function setStatusWithDebounce(next: HeartbeatResult) {
  if (next === status.value) return;
  // Online → require 3s stability before flipping
  if (next === "online" && status.value !== "online") {
    if (stabilityTimer) clearTimeout(stabilityTimer);
    stabilityTimer = setTimeout(() => {
      status.value = next;
      lastChange.value = Date.now();
      window.dispatchEvent(new CustomEvent("wl:network-changed", { detail: next }));
    }, 3000);
    return;
  }
  // Offline/captive → flip immediately
  if (stabilityTimer) {
    clearTimeout(stabilityTimer);
    stabilityTimer = null;
  }
  status.value = next;
  lastChange.value = Date.now();
  window.dispatchEvent(new CustomEvent("wl:network-changed", { detail: next }));
}

function start() {
  if (!import.meta.client || heartbeatTimer) return;
  setStatusWithDebounce(navigator.onLine ? "online" : "offline");
  window.addEventListener("online", () => probe().then(setStatusWithDebounce));
  window.addEventListener("offline", () => setStatusWithDebounce("offline"));
  // Probe every 30s when window visible
  heartbeatTimer = setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    setStatusWithDebounce(await probe());
  }, 30_000);
}

export function useNetworkStatus() {
  if (import.meta.client) start();
  return {
    status: readonly(status),
    lastChange: readonly(lastChange),
    isOnline: computed(() => status.value === "online"),
    isOffline: computed(() => status.value === "offline" || status.value === "captive_portal"),
    isCaptivePortal: computed(() => status.value === "captive_portal"),
    probe,
  };
}
```

**Step 6.4: Run test to verify pass.**

Expected: PASS.

**Step 6.5: Commit.**

```
git add composables/use-network-status.ts tests/server/use-network-status.test.mjs
git commit -m "feat(offline): add useNetworkStatus with captive portal detection"
```

## Task 7: Add idempotency middleware skeleton

**Files:**
- Create: [lib/db/schema/idempotency-key.ts](lib/db/schema/idempotency-key.ts)
- Create: [lib/db/queries/idempotency-key.ts](lib/db/queries/idempotency-key.ts)
- Create: [server/middleware/idempotency.ts](server/middleware/idempotency.ts)
- Create: [tests/server/idempotency-middleware.test.mjs](tests/server/idempotency-middleware.test.mjs)
- Modify: [drizzle/migrations/](drizzle/migrations/) (auto-generated)

**Step 7.1: Add Drizzle schema.**

Create [lib/db/schema/idempotency-key.ts](lib/db/schema/idempotency-key.ts):

```ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./user";

export const idempotencyKey = sqliteTable("idempotency_key", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  clientOpId: text("client_op_id").notNull(),
  endpoint: text("endpoint").notNull(),
  statusCode: integer("status_code").notNull(),
  responseBody: text("response_body").notNull(),
  createdAt: integer("created_at").default(sql`(unixepoch())`).notNull(),
}, table => [
  uniqueIndex("idempotency_user_op_endpoint_unique").on(table.userId, table.clientOpId, table.endpoint),
]);
```

**Step 7.2: Generate migration.**

Run: `pnpm drizzle-kit generate`

Expected: new `.sql` file in `drizzle/migrations/` with `CREATE TABLE idempotency_key`.

**Step 7.3: Add query helpers.**

Create [lib/db/queries/idempotency-key.ts](lib/db/queries/idempotency-key.ts):

```ts
import { and, eq, lt } from "drizzle-orm";
import db from "~/lib/db";
import { idempotencyKey } from "~/lib/db/schema/idempotency-key";

const TTL_SECONDS = 24 * 60 * 60;

export async function findIdempotencyHit(userId: number, clientOpId: string, endpoint: string) {
  const cutoff = Math.floor(Date.now() / 1000) - TTL_SECONDS;
  const rows = await db.select().from(idempotencyKey).where(and(
    eq(idempotencyKey.userId, userId),
    eq(idempotencyKey.clientOpId, clientOpId),
    eq(idempotencyKey.endpoint, endpoint),
  )).limit(1);
  if (rows.length === 0) return null;
  if (rows[0].createdAt < cutoff) return null;
  return rows[0];
}

export async function recordIdempotencyResult(userId: number, clientOpId: string, endpoint: string, statusCode: number, responseBody: string) {
  await db.insert(idempotencyKey).values({
    userId, clientOpId, endpoint, statusCode, responseBody,
  }).onConflictDoNothing();
}

export async function purgeExpiredIdempotencyKeys() {
  const cutoff = Math.floor(Date.now() / 1000) - TTL_SECONDS;
  await db.delete(idempotencyKey).where(lt(idempotencyKey.createdAt, cutoff));
}
```

**Step 7.4: Write failing middleware test.**

Create [tests/server/idempotency-middleware.test.mjs](tests/server/idempotency-middleware.test.mjs):

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isIdempotentEndpoint, shouldApplyMiddleware } from "../../server/middleware/idempotency.ts";

describe("idempotency middleware filters", () => {
  it("applies to POST /api/locations/:slug/:id/image", () => {
    assert.equal(shouldApplyMiddleware({ method: "POST", path: "/api/locations/foo/1/image" }), true);
  });
  it("applies to POST /api/posts/:id/comments", () => {
    assert.equal(shouldApplyMiddleware({ method: "POST", path: "/api/posts/5/comments" }), true);
  });
  it("applies to POST /api/posts/:id/like", () => {
    assert.equal(shouldApplyMiddleware({ method: "POST", path: "/api/posts/5/like" }), true);
  });
  it("does not apply to GET requests", () => {
    assert.equal(shouldApplyMiddleware({ method: "GET", path: "/api/posts/5" }), false);
  });
  it("does not apply to /api/auth", () => {
    assert.equal(shouldApplyMiddleware({ method: "POST", path: "/api/auth/login" }), false);
  });
  it("does not apply to /api/health", () => {
    assert.equal(shouldApplyMiddleware({ method: "POST", path: "/api/health" }), false);
  });
});
```

**Step 7.5: Run test to verify fail.**

Expected: FAIL.

**Step 7.6: Implement middleware.**

Create [server/middleware/idempotency.ts](server/middleware/idempotency.ts):

```ts
import { findIdempotencyHit, recordIdempotencyResult } from "~/lib/db/queries/idempotency-key";

const WHITELIST_PATTERNS: RegExp[] = [
  /^\/api\/locations\/[^/]+\/\d+\/image$/,
  /^\/api\/locations\/[^/]+\/add$/,
  /^\/api\/locations\/[^/]+\/\d+$/,
  /^\/api\/posts$/,
  /^\/api\/posts\/\d+\/like$/,
  /^\/api\/posts\/\d+\/comments$/,
];

const BLOCKLIST_PATTERNS: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/health(\/|$)/,
];

export function shouldApplyMiddleware(input: { method: string; path: string }) {
  if (input.method !== "POST" && input.method !== "PUT" && input.method !== "DELETE") return false;
  if (BLOCKLIST_PATTERNS.some(p => p.test(input.path))) return false;
  return WHITELIST_PATTERNS.some(p => p.test(input.path));
}

export function isIdempotentEndpoint(path: string) {
  return WHITELIST_PATTERNS.some(p => p.test(path));
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  if (!shouldApplyMiddleware({ method: event.method, path: url.pathname })) return;
  const userId = event.context.user?.id;
  if (!userId) return;
  const opId = getRequestHeader(event, "x-client-op-id");
  if (!opId) return;

  const hit = await findIdempotencyHit(userId, opId, url.pathname);
  if (hit) {
    setResponseStatus(event, hit.statusCode);
    setResponseHeader(event, "content-type", "application/json");
    setResponseHeader(event, "x-idempotent-replay", "true");
    return JSON.parse(hit.responseBody);
  }

  // Hook into response phase to record the result
  event.context._idempotencyKey = { userId, opId, endpoint: url.pathname };
});
```

Note: recording the response requires a small addition in each whitelisted endpoint (or a Nitro response hook). To keep this task scoped, we add a tiny helper that endpoints can opt-into:

In [server/middleware/idempotency.ts](server/middleware/idempotency.ts) append:

```ts
export async function recordIdempotentResponse(event: any, statusCode: number, body: unknown) {
  const meta = event.context._idempotencyKey;
  if (!meta) return;
  await recordIdempotencyResult(meta.userId, meta.opId, meta.endpoint, statusCode, JSON.stringify(body));
}
```

**Step 7.7: Run tests to verify pass.**

Run: `node scripts/run-node-tests.mjs tests/server/idempotency-middleware.test.mjs`

Expected: PASS.

**Step 7.8: Commit.**

```
git add lib/db/schema/idempotency-key.ts lib/db/queries/idempotency-key.ts server/middleware/idempotency.ts tests/server/idempotency-middleware.test.mjs drizzle/migrations
git commit -m "feat(offline): add idempotency middleware + idempotency_key table"
```

**Phase 1 verification:** All Phase 1 tests pass. SW boots in dev. Existing route-generation push still works.

Run: `node scripts/run-node-tests.mjs tests/server`
Expected: all green, including new Phase 1 tests.

---

# PHASE 2 — Read cache hardening

Goal: Verify NF/CF/SWR strategies behave correctly under quota pressure and after mutations. Add cache-invalidation hook.

## Task 8: Cache invalidation helper

**Files:**
- Create: [composables/use-cache-invalidate.ts](composables/use-cache-invalidate.ts)
- Create: [tests/server/cache-invalidate.test.mjs](tests/server/cache-invalidate.test.mjs)

**Step 8.1: Test contract.**

Test that `invalidateApiCache(urls)` posts a `wl-invalidate-cache` message to the SW; SW deletes matching entries from `wl-api-v1`.

**Step 8.2: Implement composable.**

```ts
export function useCacheInvalidate() {
  async function invalidateApiCache(urls: string[]) {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "wl-invalidate-cache", urls });
  }
  return { invalidateApiCache };
}
```

**Step 8.3: Add SW handler in `wanderlog-sw.js`:**

In the `message` listener:

```js
if (event.data?.type === "wl-invalidate-cache") {
  const urls = event.data.urls || [];
  const cache = await caches.open("wl-api-v1");
  await Promise.all(urls.map(url => cache.delete(url, { ignoreSearch: false })));
}
```

**Step 8.4: Commit.**

```
git commit -m "feat(offline): add cache invalidation hook from client → SW"
```

## Task 9: SW integration test — runtime cache behaviour

**Files:**
- Create: [tests/server/sw-runtime-cache.test.mjs](tests/server/sw-runtime-cache.test.mjs)

Test source-level assertions: `wl-api-v1` cache name, `networkTimeoutSeconds: 4`, ExpirationPlugin maxEntries 100/200, purgeOnQuotaError true. Same pattern as Task 3 assertions but focused on `ExpirationPlugin` config.

Commit: `test(pwa): runtime cache strategy assertions`

---

# PHASE 3 — Write queue (non-photo)

Goal: Build the `useOfflineQueue` composable + Pinia store that drive optimistic UI for likes, comments, log creates.

## Task 10: `useOfflineQueue` composable

**Files:**
- Create: [composables/use-offline-queue.ts](composables/use-offline-queue.ts)
- Create: [tests/server/use-offline-queue.test.mjs](tests/server/use-offline-queue.test.mjs)

**Step 10.1: Failing test.**

```js
// Tests for:
// - enqueue() writes to IDB + returns immediately
// - enqueue() generates unique opId
// - double enqueue of same opId is a no-op (idempotency at the queue layer)
// - drop(opId) removes from IDB
// - 401 from server doesn't remove from IDB
```

Use `fake-indexeddb` (already added in Task 4).

**Step 10.2: Implement composable.**

```ts
import { nanoid } from "nanoid";
import type { PendingOp, PendingOpKind } from "~/lib/offline/operation-types";
import { putOperation, removeOperation, listOperations, updateOperationStatus } from "~/lib/offline/idb";

export function useOfflineQueue() {
  async function enqueue(kind: PendingOpKind, opIdOverride?: string): Promise<{ opId: string; response: Response }> {
    const opId = opIdOverride || nanoid();
    const op: PendingOp = {
      ...kind,
      opId,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retries: 0,
    };
    await putOperation(op);

    const { url, method, body } = mapToRequest(kind);
    try {
      const csrf = useCsrf().csrf.value;
      const response = await fetch(url, {
        method,
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
          "x-client-op-id": opId,
          ...(csrf ? { "csrf-token": csrf } : {}),
        },
      });
      if (response.ok) {
        await removeOperation(opId);
      }
      else if (response.status === 401) {
        await updateOperationStatus(opId, { status: "auth_required", lastError: "Session expired" });
      }
      else if (response.status === 409) {
        await updateOperationStatus(opId, { status: "conflict" });
      }
      else if (response.status === 422) {
        const txt = await response.clone().text();
        await updateOperationStatus(opId, { status: "invalid", lastError: txt });
      }
      return { opId, response };
    }
    catch (err) {
      // Offline — SW BackgroundSyncPlugin holds the request; we keep the op
      return { opId, response: new Response(null, { status: 202 }) };
    }
  }

  async function drop(opId: string) {
    await removeOperation(opId);
  }

  async function peek() {
    return listOperations();
  }

  function mapToRequest(kind: PendingOpKind): { url: string; method: string; body: any } {
    switch (kind.type) {
      case "log.create":
        return { url: `/api/locations/${kind.payload.locationSlug}/add`, method: "POST", body: kind.payload };
      case "log.update":
        return { url: `/api/locations/${kind.payload.locationSlug}/${kind.payload.logId}`, method: "PUT", body: kind.payload };
      case "post.like":
        return { url: `/api/posts/${kind.payload.postId}/like`, method: kind.payload.action === "like" ? "POST" : "DELETE", body: {} };
      case "post.comment":
        return { url: `/api/posts/${kind.payload.postId}/comments`, method: "POST", body: kind.payload };
      case "photo.upload":
        throw new Error("Photo uploads use a separate queue — see Task 14");
    }
  }

  return { enqueue, drop, peek };
}
```

**Step 10.3: Verify tests pass and commit.**

```
git commit -m "feat(offline): add useOfflineQueue for non-photo writes"
```

## Task 11: Pinia store `pending-operations` + BroadcastChannel listener

**Files:**
- Create: [stores/pending-operations.ts](stores/pending-operations.ts)
- Create: [tests/server/pending-operations-store.test.mjs](tests/server/pending-operations-store.test.mjs)

**Step 11.1: Test contract.**

- `store.init()` loads operations from IDB.
- BroadcastChannel `wl-sync` message with `{status:'success', opId}` removes op from store + IDB.
- BroadcastChannel message with `{status:'conflict'|'invalid'|'expired', opId}` updates status field.

**Step 11.2: Implement store.**

```ts
import { defineStore } from "pinia";
import { listOperations, removeOperation, updateOperationStatus } from "~/lib/offline/idb";
import type { PendingOp } from "~/lib/offline/operation-types";

export const usePendingOperationsStore = defineStore("pending-operations", () => {
  const operations = ref<PendingOp[]>([]);
  const channel = ref<BroadcastChannel | null>(null);

  async function init() {
    if (!import.meta.client) return;
    operations.value = await listOperations();
    if (!channel.value) {
      channel.value = new BroadcastChannel("wl-sync");
      channel.value.addEventListener("message", handleSyncMessage);
    }
  }

  async function handleSyncMessage(event: MessageEvent) {
    const { status, opId } = event.data || {};
    if (!opId) return;
    if (status === "success") {
      await removeOperation(opId);
      operations.value = operations.value.filter(o => o.opId !== opId);
    }
    else if (status === "conflict" || status === "invalid" || status === "expired" || status === "auth_required") {
      await updateOperationStatus(opId, { status });
      const idx = operations.value.findIndex(o => o.opId === opId);
      if (idx >= 0) operations.value[idx] = { ...operations.value[idx], status };
    }
  }

  async function refresh() {
    operations.value = await listOperations();
  }

  const pendingCount = computed(() => operations.value.filter(o => o.status === "pending").length);
  const blockedCount = computed(() => operations.value.filter(o => o.status !== "pending").length);

  return { operations: readonly(operations), pendingCount, blockedCount, init, refresh };
});
```

**Step 11.3: Commit.**

```
git commit -m "feat(offline): pinia store for pending operations + broadcast channel sync"
```

## Task 12: Hook idempotency middleware into 3 endpoints (likes, comments, log create)

**Files:**
- Modify: [server/api/posts/[id]/like.post.ts](server/api/posts/[id]/like.post.ts)
- Modify: [server/api/posts/[id]/comments.post.ts](server/api/posts/[id]/comments.post.ts)
- Modify: [server/api/locations/[slug]/add.post.ts](server/api/locations/[slug]/add.post.ts)

For each: at the end, call `await recordIdempotentResponse(event, 200, result)` before returning.

Add server-wide middleware registration via Nuxt convention (file at `server/middleware/idempotency.ts` auto-runs — already created in Task 7).

Test: integration test that hits like endpoint twice with same `x-client-op-id` and asserts second call returns identical response without inserting a second row.

Commit: `feat(offline): apply idempotency to like/comment/log-create endpoints`

## Task 13: Switch ImageList likes/comments forms to useOfflineQueue

**Files:**
- Modify: [app/components/feed/post-card.vue](app/components/feed/post-card.vue) (or wherever like button is)
- Modify: [app/components/feed/post-comment-form.vue](app/components/feed/post-comment-form.vue)

Replace direct `$fetch('/api/posts/:id/like', ...)` with `useOfflineQueue().enqueue({type:'post.like', payload:{postId, action}})`. UI optimistically updates count.

Test: manual — turn off devtools network, tap like, see count increment; reload page → pending op still in store; reconnect → BroadcastChannel removes from store.

Commit: `feat(offline): wire likes + comments through offline queue`

---

# PHASE 4 — Photo upload queue

Goal: Custom Workbox `Queue.onSync` for the 3-step photo upload (sign → S3 PUT → confirm) with blob persistence in IDB.

## Task 14: Photo enqueue path in `useOfflineQueue`

**Files:**
- Modify: [composables/use-offline-queue.ts](composables/use-offline-queue.ts)
- Modify: [pages/dashboard/location/[slug]/[id]/images.vue](pages/dashboard/location/[slug]/[id]/images.vue)

**Step 14.1: Add `enqueuePhoto(blob, meta)` method.**

```ts
async function enqueuePhoto(blob: Blob, meta: { locationSlug: string; logId: number }) {
  const opId = nanoid();
  await putPhotoBlob(opId, blob);
  const checksum = await computeChecksum(blob);
  const op: PendingOp = {
    opId, type: "photo.upload",
    payload: { ...meta, blobRef: opId, mimeType: blob.type, checksum },
    status: "pending", createdAt: Date.now(), updatedAt: Date.now(), retries: 0,
  };
  await putOperation(op);
  // Trigger immediate attempt
  await processPhotoOp(op);
  return { opId };
}

async function processPhotoOp(op: PendingOp) {
  if (op.type !== "photo.upload") return;
  try {
    if (op.payload.partial !== "s3-done") {
      const blob = await getPhotoBlob(op.opId);
      if (!blob) {
        await updateOperationStatus(op.opId, { status: "corrupted", lastError: "Blob missing" });
        return;
      }
      const csrf = useCsrf().csrf.value;
      const { url, fields, key } = await $fetch(`/api/locations/${op.payload.locationSlug}/${op.payload.logId}/sign-images`, {
        method: "POST",
        headers: { "x-client-op-id": op.opId, ...(csrf ? { "csrf-token": csrf } : {}) },
        body: { checksum: op.payload.checksum, contentLength: blob.size },
      });
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", blob);
      const s3res = await fetch(url, { method: "POST", body: formData });
      if (!s3res.ok) throw new Error(`S3 PUT ${s3res.status}`);
      await updateOperationStatus(op.opId, { payload: { ...op.payload, partial: "s3-done" } as any });
      op.payload.partial = "s3-done";
      op.payload = { ...op.payload, key } as any;
    }
    // Step 3: confirm
    const csrf = useCsrf().csrf.value;
    await $fetch(`/api/locations/${op.payload.locationSlug}/${op.payload.logId}/image`, {
      method: "POST",
      headers: { "x-client-op-id": op.opId, ...(csrf ? { "csrf-token": csrf } : {}) },
      body: { key: (op.payload as any).key },
    });
    await deletePhotoBlob(op.opId);
    await removeOperation(op.opId);
    const ch = new BroadcastChannel("wl-sync");
    ch.postMessage({ status: "success", opId: op.opId });
    ch.close();
  }
  catch (err) {
    const next = (op.retries || 0) + 1;
    if (next >= 5) {
      await updateOperationStatus(op.opId, { status: "expired", retries: next, lastError: String(err) });
    }
    else {
      await updateOperationStatus(op.opId, { retries: next, lastError: String(err) });
    }
  }
}
```

**Step 14.2: Wire into images.vue.**

Replace existing `uploadImage` function with:

```ts
async function uploadImage() {
  if (!imageFile.value) return;
  const blob = await resizeToBlob(imageFile.value); // existing canvas logic extracted
  const { opId } = await useOfflineQueue().enqueuePhoto(blob, {
    locationSlug: route.params.slug as string,
    logId: Number(route.params.id),
  });
  // optimistic UI: push pending entry into local image list (read from Pinia store)
  imageFile.value = null;
  imageUrl.value = null;
}
```

**Step 14.3: Add retry-on-reconnect.**

In `useOfflineQueue` add an effect that listens to `wl:network-changed` event from `use-network-status.ts`. When status flips to `online`, iterate stuck photo operations and call `processPhotoOp` for each.

**Step 14.4: Commit.**

```
git commit -m "feat(offline): photo upload queue with blob persistence + re-sign on replay"
```

## Task 15: `queued-photo-thumb` Vue component

**Files:**
- Create: [app/components/offline/queued-photo-thumb.vue](app/components/offline/queued-photo-thumb.vue)

Reads `photo_blobs[opId]` via `getPhotoBlob`, calls `URL.createObjectURL`, revokes in `onBeforeUnmount`. Shows pending badge overlay.

```vue
<script setup lang="ts">
import { getPhotoBlob } from "~/lib/offline/idb";

const props = defineProps<{ opId: string; status: string }>();
const url = ref<string | null>(null);

onMounted(async () => {
  const blob = await getPhotoBlob(props.opId);
  if (blob) url.value = URL.createObjectURL(blob);
});

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>

<template>
  <div class="relative">
    <img v-if="url" :src="url" class="w-full h-full object-cover" alt="Pending upload">
    <div v-else class="bg-gray-200 animate-pulse" />
    <OfflinePendingBadge :status="status" class="absolute right-1 top-1" />
  </div>
</template>
```

Commit: `feat(offline): queued-photo-thumb component`

---

# PHASE 5 — UI overlays

## Task 16: `OfflinePendingBadge` component

Variants: `pending` (spinner), `auth_required` (lock icon), `conflict` (warning), `invalid` (red dot), `expired` (red exclamation), `corrupted` (red x). Use `@nuxt/icon` (already in deps).

Commit: `feat(offline): pending badge component`

## Task 17: `OfflineBanner` component + layouts/default.vue integration

Sticky top banner shown when `useNetworkStatus().isOffline.value === true` OR `usePendingOperationsStore().blockedCount > 0`. Tap → open SyncDrawer.

```vue
<script setup>
const { isOffline, isCaptivePortal } = useNetworkStatus();
const store = usePendingOperationsStore();
const open = ref(false);

const message = computed(() => {
  if (isCaptivePortal.value) return "Wi-Fi требует входа — войдите в браузере чтобы синхронизировать";
  if (isOffline.value) return `Офлайн — ${store.pendingCount} операций в очереди`;
  if (store.blockedCount > 0) return `${store.blockedCount} операций требуют внимания`;
  return "";
});
</script>

<template>
  <div v-if="message" class="sticky top-0 z-50 bg-amber-500/95 px-4 py-2 text-sm text-amber-50 cursor-pointer" @click="open = true">
    {{ message }}
  </div>
  <OfflineSyncDrawer v-model="open" />
</template>
```

Mount in [layouts/default.vue](layouts/default.vue) at top of template.

Commit: `feat(offline): top offline banner`

## Task 18: `OfflineSyncDrawer` component

Drawer showing list of pending ops with: preview (queued-photo-thumb for photos, payload summary for others), status badge, retry button (for `expired`/`invalid`), discard button.

Commit: `feat(offline): sync drawer with queue list and per-op actions`

## Task 19: Add Pinia store init to `app.vue`

```ts
const pending = usePendingOperationsStore();
onMounted(() => pending.init());
```

Commit: `chore(offline): init pending-operations store on app mount`

---

# PHASE 6 — Push generalization

## Task 20: `push_subscription` table + Drizzle migration

**Files:**
- Create: [lib/db/schema/push-subscription.ts](lib/db/schema/push-subscription.ts)
- Create: data migration moving existing `route_notification_subscription` rows to new table with `types: ['route']`.

```ts
export const pushSubscription = sqliteTable("push_subscription", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  types: text("types", { mode: "json" }).$type<string[]>().notNull(),
  userAgent: text("user_agent"),
  createdAt: integer("created_at").default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at").default(sql`(unixepoch())`).notNull(),
}, table => [
  uniqueIndex("push_subscription_endpoint_unique").on(table.endpoint),
]);
```

Generate migration. Include data-migration SQL.

Commit: `feat(push): push_subscription table + migration from route_notification_subscription`

## Task 21: Query helpers + dispatch.ts with digest logic

**Files:**
- Create: [lib/db/queries/push-subscription.ts](lib/db/queries/push-subscription.ts)
- Create: [lib/notifications/dispatch.ts](lib/notifications/dispatch.ts)
- Create: [tests/server/push-dispatch.test.mjs](tests/server/push-dispatch.test.mjs)
- Add: `pnpm add web-push @types/web-push`

```ts
// lib/notifications/dispatch.ts
import webpush from "web-push";
import env from "~/lib/env";
import { getSubscriptionsByUserAndType, removeByEndpoint } from "~/lib/db/queries/push-subscription";

webpush.setVapidDetails(
  `mailto:${env.ROUTE_NOTIFICATION_VAPID_MAILTO || "noreply@wanderlog.app"}`,
  env.ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY,
  env.ROUTE_NOTIFICATION_VAPID_PRIVATE_KEY,
);

const recentDigests = new Map<string, { count: number; firstAt: number }>();
const DIGEST_WINDOW_MS = 10 * 60 * 1000;

export async function dispatchPush(input: {
  userId: number;
  type: string;
  payload: Record<string, unknown>;
  digestKey?: string;
}) {
  let body = input.payload;
  if (input.digestKey && input.type.startsWith("social.")) {
    const key = `${input.userId}:${input.digestKey}`;
    const entry = recentDigests.get(key);
    const now = Date.now();
    if (entry && now - entry.firstAt < DIGEST_WINDOW_MS) {
      entry.count++;
      body = { ...body, digestCount: entry.count, title: `${entry.count + 1} новых событий` };
    }
    else {
      recentDigests.set(key, { count: 1, firstAt: now });
    }
  }

  const subs = await getSubscriptionsByUserAndType(input.userId, input.type);
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, JSON.stringify({ type: input.type, ...body }));
    }
    catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await removeByEndpoint(sub.endpoint);
      }
    }
  }));
}
```

Tests assert:
- only subscribers of matching type receive
- 410 endpoint is removed
- digest merges >1 event in 10 min window into a single payload with `digestCount`

Commit: `feat(push): generalized dispatch with digest logic`

## Task 22: New subscription endpoints

**Files:**
- Create: [server/api/notifications/push-subscription.post.ts](server/api/notifications/push-subscription.post.ts)
- Create: [server/api/notifications/push-subscription/[type].delete.ts](server/api/notifications/push-subscription/[type].delete.ts)
- Modify: [server/api/notifications/route-generation-subscription.post.ts](server/api/notifications/route-generation-subscription.post.ts) — forward to new endpoint with `types:['route']` for backward compat.

Commit: `feat(push): universal subscription endpoints with per-type opt-in`

## Task 23: Update `use-route-generation-notifications.ts` → generic `use-push-notifications.ts`

Keep the existing composable as a thin wrapper. Add a new generic `usePushNotifications()` composable that accepts `types: PushType[]` and writes them to `push_settings` IDB store + server.

Commit: `feat(push): generic usePushNotifications composable`

## Task 24: Settings UI for per-type opt-in

Create [app/components/settings/notifications-section.vue](app/components/settings/notifications-section.vue) with checkboxes: Социальные, Загрузки, Напоминания, Маршруты. Mount in a settings page (create [pages/settings.vue](pages/settings.vue) if absent — basic placeholder is fine).

Commit: `feat(push): per-type opt-in settings UI`

---

# PHASE 7 — Push triggers (server-side)

## Task 25: Dispatch `social.like` from like endpoint

**File:** [server/api/posts/[id]/like.post.ts](server/api/posts/[id]/like.post.ts)

After insert + idempotency record:
```ts
const post = await getPostWithAuthor(postId);
if (post.userId !== event.context.user.id) {
  await dispatchPush({
    userId: post.userId,
    type: "social.like",
    payload: { title: "Новый лайк", body: `${event.context.user.name} лайкнул ваш пост`, url: `/feed?postId=${postId}` },
    digestKey: `post-${postId}-like`,
  });
}
```

Commit: `feat(push): dispatch social.like on new like`

## Task 26: Dispatch `social.comment` / `social.reply`

**File:** [server/api/posts/[id]/comments.post.ts](server/api/posts/[id]/comments.post.ts)

If new comment is reply → `social.reply` to `replyToUserId`; else `social.comment` to post author.

Commit: `feat(push): dispatch social.comment and social.reply`

## Task 27: Local upload-success notification in SW

**File:** [public/wanderlog-sw.js](public/wanderlog-sw.js)

In the `wl-writes` queue `onSync` handler, after `success` broadcast: if the request URL ends with `/image`, call `self.registration.showNotification('Фото загружено', { tag:'upload-success', ... })` (subject to user opt-in stored in IDB).

Commit: `feat(push): local upload-success notification from SW`

---

# PHASE 8 — Edge case hardening

## Task 28: 401 resume after sign-in

**Files:**
- Modify: [composables/use-offline-queue.ts](composables/use-offline-queue.ts)
- Modify: sign-in handler page

After successful sign-in, postMessage SW: `{type: 'wl-manual-sync'}`. Then `usePendingOperationsStore().refresh()`.

Commit: `feat(offline): resume offline queue after re-login`

## Task 29: `navigator.storage.persist()` prompt

**Files:**
- Modify: [composables/use-offline-queue.ts](composables/use-offline-queue.ts)

Before first photo enqueue, call `requestPersistentStorage()`. If declined, show a one-time toast warning.

Commit: `feat(offline): request persistent storage before first photo enqueue`

## Task 30: Double-tap prevention on forms

For each write form: disable submit button immediately on click; generate `clientOpId` on form mount; reset only on success. Apply in [pages/dashboard/location/[slug]/[id]/images.vue](pages/dashboard/location/[slug]/[id]/images.vue), comment form, like button.

Commit: `feat(offline): disable submit + stable clientOpId per form`

## Task 31: Storage quota guard in `enqueuePhoto`

Before `putPhotoBlob`, call `estimateStorageUsage()`. If ratio > 0.8 → throw with friendly message → UI toast: «Хранилище заполнено».

Commit: `feat(offline): storage quota guard before photo enqueue`

## Task 32: iOS A2HS onboarding banner

Detect iOS Safari (`navigator.userAgent` + `!('standalone' in navigator) || !navigator.standalone`). Show banner explaining A2HS for push.

Commit: `feat(pwa): iOS Add to Home Screen onboarding banner`

---

# PHASE 9 — Testing & verification

## Task 33: Server test suite — final pass

Run: `pnpm test:server`
Expected: 115+ existing tests + ~25 new tests all green.

## Task 34: Manual E2E checklist

Create [tests/manual/pwa-offline-checklist.md](tests/manual/pwa-offline-checklist.md) with 10 scenarios from §7.3 of the design doc (E1–E10). Run each manually on Chrome desktop + Chrome Android. Document results inline.

Commit: `docs(pwa): manual e2e checklist + sign-off`

## Task 35: Lighthouse PWA audit

Run Lighthouse against `pnpm build && pnpm preview` output. Target ≥90 PWA score.

If failing: investigate, fix, repeat. Commit any tweaks under `chore(pwa): lighthouse audit tweaks`.

## Task 36: Real device test

iPhone Safari → Add to Home Screen → switch to airplane mode → create log + add comment → switch back → verify data on server.

Record outcome in [docs/plans/2026-05-24-pwa-offline-verification.md](docs/plans/2026-05-24-pwa-offline-verification.md).

## Task 37: Final commit + PR-ready summary

`git log --oneline main..HEAD` — verify ~36 atomic commits.

Push branch + open PR with summary referencing this plan and design doc.

---

# Acceptance criteria (mirrors design §7.5)

1. ✅ `pnpm test:server` зелёный, включая все новые tests
2. ✅ 10 manual E2E пройдены на Chrome desktop + Chrome Android
3. ✅ Lighthouse PWA ≥90
4. ✅ iPhone Safari A2HS real-device тест прошёл (offline create → online → data on server)
5. ✅ Existing route-generation push regression test зелёный

---

# Notes for the implementing engineer

- **Frequent commits**: each Task is a single logical commit. If a task feels >30 min of work, split it.
- **Don't skip TDD**: even when "obvious" — the test is the spec.
- **Don't extend scope**: if you find a refactor opportunity outside this plan, file it via the spawn_task chip mechanism (do not silently expand commits).
- **Reference design doc**: when unclear how something should behave, the [design doc](docs/plans/2026-05-24-pwa-offline-design.md) is authoritative.
- **Use `@superpowers:executing-plans`** sub-skill to step through this document.

