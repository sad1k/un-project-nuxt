// WanderLog service worker.
//
// Caches the static app shell (HTML/CSS/JS bundles, fonts, icons) so the
// SPA boots offline — letting the IndexedDB-backed offline-map UX
// actually run when the network drops. Private data (API, auth, user
// photos) and provider hosts (Mapbox, OSM, Protomaps) stay strictly
// bypassed; they go straight to network and fail honestly when offline.

const APP_SHELL_CACHE = "wanderlog-app-shell-v2";
const RUNTIME_CACHE = "wanderlog-runtime-v1";
const NAV_CACHE = "wanderlog-nav-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/wanderlog-icon-192.png",
  "/icons/wanderlog-icon-512.png",
  "/icons/wanderlog-maskable-512.png",
];

// Strict bypass — these requests are never cached and never replayed
// from cache, even when offline. Keeps personal data fresh and provider
// hosts in charge of their own caching/ToS.
const BYPASS_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/api/auth",
  "/api/explore/place-story/audio",
];

const BYPASS_HOST_PATTERNS = [
  "api.mapbox.com",
  "events.mapbox.com",
  "tiles.mapbox.com",
  "api.open-meteo.com",
  "nominatim.openstreetmap.org",
  "demo-bucket.protomaps.com",
];

// Same-origin paths safe to runtime-cache. `/_nuxt/` is the Nuxt build
// output with hashed filenames — immutable per build, so a long-lived
// CacheFirst entry is correct.
const RUNTIME_CACHE_PREFIXES = ["/_nuxt/", "/icons/", "/screenshots/", "/styles/"];

const RUNTIME_CACHE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(PRECACHE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const allowed = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, NAV_CACHE]);
    await Promise.all(keys
      .filter(key => key.startsWith("wanderlog-") && !allowed.has(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || shouldBypassRequest(request))
    return;

  const url = new URL(request.url);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isNavigate = request.mode === "navigate" || acceptsHtml;

  if (isNavigate) {
    event.respondWith(handleNavigate(request));
    return;
  }

  if (url.origin === self.location.origin
    && RUNTIME_CACHE_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (RUNTIME_CACHE_HOSTS.some(host => url.hostname === host))
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
});

async function handleNavigate(request) {
  // Network-first for HTML so logged-in users always see fresh shell,
  // but cache the response so the same URL works on the next offline
  // visit. SSR-off pages (`/explore`, `/dashboard`, `/feed`) are just
  // the SPA shell and identical across users, so caching them is safe.
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(NAV_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }
  catch {
    const navCache = await caches.open(NAV_CACHE);
    const cached = await navCache.match(request);
    if (cached)
      return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached)
    return cached;
  try {
    const response = await fetch(request);
    if (response.ok)
      await cache.put(request, response.clone());
    return response;
  }
  catch (error) {
    if (cached)
      return cached;
    throw error;
  }
}

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  }
  catch {
    payload = {};
  }

  const title = payload.title || "Генерация маршрута завершена";
  const options = {
    body: payload.body || "Ваш маршрут WanderLog готов.",
    data: {
      sessionId: payload.sessionId,
      url: payload.sessionId ? `/explore?sessionId=${payload.sessionId}` : "/explore",
    },
    icon: "/icons/wanderlog-icon-192.png",
    tag: payload.variantId ? `route-generation:${payload.variantId}` : "route-generation",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/explore", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    const existingClient = windows.find(client => client.url === targetUrl);

    if (existingClient)
      return existingClient.focus();

    return self.clients.openWindow(targetUrl);
  })());
});

function shouldBypassRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin)
    return BYPASS_HOST_PATTERNS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));

  return BYPASS_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))
    || url.pathname.includes("/locations/")
    || url.pathname.includes("/image")
    || url.pathname.includes("/place-story/audio");
}
