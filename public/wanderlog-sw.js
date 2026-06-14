import { Queue } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";
import { matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

const OFFLINE_URL = "/offline.html";
// Prerendered SPA shell that boots into the saved offline maps (IndexedDB).
const OFFLINE_SHELL_URL = "/offline";
// Cache name for the offline shell — versioned so an update forces re-fetch.
const SHELL_CACHE = "wl-shell-v1";

// 1) Precache app shell (manifest injected by vite-pwa injectManifest build)
precacheAndRoute(self.__WB_MANIFEST || []);

// 1b) Cache the offline shell at install time so it's available for cold
// offline starts even when the workbox precache manifest is empty (e.g. in
// dev or when the build pipeline doesn't inject __WB_MANIFEST).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.add(OFFLINE_SHELL_URL)),
  );
});

// 2) Runtime caches
// 2a) Nuxt static assets: SWR with no expiration limits (build-time hashed)
registerRoute(
  ({ url }) => url.pathname.startsWith("/_nuxt/")
    || url.pathname.startsWith("/icons/")
    || url.pathname.startsWith("/screenshots/")
    || url.pathname.startsWith("/fonts/"),
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

// 3) Write queue: Queue directly for non-photo mutations
const writeQueue = new Queue("wl-writes", {
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

// Match mutating /api/ requests EXCEPT photo sign-images and auth (single route filters all methods)
registerRoute(
  ({ url, request }) => ["POST", "PUT", "DELETE"].includes(request.method)
    && url.pathname.startsWith("/api/")
    && !url.pathname.includes("/sign-images")
    && !url.pathname.startsWith("/api/auth"),
  async ({ event }) => {
    try {
      return await fetch(event.request.clone());
    }
    catch {
      // Only POST enqueues for now (PUT/DELETE retry is follow-up work)
      if (event.request.method === "POST") {
        await writeQueue.pushRequest({ request: event.request.clone() });
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error("Offline");
    }
  },
);

// 4) Navigation fallback: when offline, boot the prerendered /offline app
// shell from the precache so the SPA cold-starts into the saved offline maps
// (rendered from IndexedDB). Non-shell navigations redirect to /offline so the
// client router lands there; the shell itself is served from the precache.
registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      return await fetch(event.request);
    }
    catch {
      const { pathname } = new URL(event.request.url);
      const onShell = pathname === OFFLINE_SHELL_URL || pathname === `${OFFLINE_SHELL_URL}/`;
      if (!onShell)
        return Response.redirect(OFFLINE_SHELL_URL, 302);

      // Try precache first (populated when vite-pwa injects __WB_MANIFEST),
      // then fall back to the install-time shell cache (always populated).
      const shell = await matchPrecache(`${OFFLINE_SHELL_URL}/index.html`)
        || await matchPrecache(OFFLINE_SHELL_URL)
        || await caches.match(OFFLINE_SHELL_URL, { cacheName: SHELL_CACHE })
        || await matchPrecache(OFFLINE_URL);
      return shell || Response.error();
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
  try {
    focused.postMessage({ type: "wl-in-app-toast", payload });
    return true;
  }
  catch {
    return false;
  }
}
