const APP_SHELL_CACHE = "wanderlog-app-shell-v1";
const OFFLINE_URL = "/offline.html";
const APP_SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/wanderlog-icon-192.png",
  "/icons/wanderlog-maskable-512.png",
];

const BYPASS_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/api/auth",
  "/api/explore/place-story/audio",
  "/_nuxt/",
];

const BYPASS_HOST_PATTERNS = [
  "api.mapbox.com",
  "events.mapbox.com",
  "tiles.mapbox.com",
  "api.open-meteo.com",
  "nominatim.openstreetmap.org",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(APP_SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("wanderlog-app-shell-") && key !== APP_SHELL_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || shouldBypassRequest(request))
    return;

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (request.mode !== "navigate" && !acceptsHtml)
    return;

  event.respondWith((async () => {
    try {
      return await fetch(request);
    }
    catch {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }
  })());
});

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
