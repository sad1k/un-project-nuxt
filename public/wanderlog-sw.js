import { BackgroundSyncPlugin } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

const OFFLINE_URL = "/offline.html";

// 1) Precache app shell (manifest injected by vite-pwa injectManifest build)
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
  maxRetentionTime: 24 * 60,
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
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

// Match mutating /api/ requests EXCEPT photo sign-images (custom queue handles photos)
registerRoute(
  ({ url, request }) => (request.method === "POST" || request.method === "PUT" || request.method === "DELETE")
    && url.pathname.startsWith("/api/")
    && !url.pathname.includes("/sign-images")
    && !url.pathname.startsWith("/api/auth"),
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
  "POST",
);
registerRoute(/.*\/api\//, ({ event }) => fetch(event.request), "PUT");
registerRoute(/.*\/api\//, ({ event }) => fetch(event.request), "DELETE");

// 4) Navigation fallback to offline.html
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

// 6) Manual sync trigger (Safari fallback) + cache invalidate from client
self.addEventListener("message", async (event) => {
  if (event.data?.type === "wl-manual-sync") {
    try {
      await self.registration.sync?.register("wl-writes");
    }
    catch {
      // Background Sync not supported; no-op
    }
  }
  if (event.data?.type === "wl-clear-user-cache") {
    await caches.delete("wl-api-v1");
  }
  if (event.data?.type === "wl-invalidate-cache") {
    const urls = event.data.urls || [];
    const cache = await caches.open("wl-api-v1");
    await Promise.all(urls.map(url => cache.delete(url, { ignoreSearch: false })));
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
