self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  }
  catch {
    payload = {};
  }

  const title = payload.title || "Route generation complete";
  const options = {
    body: payload.body || "Your WanderLog route is ready.",
    data: {
      sessionId: payload.sessionId,
      url: payload.sessionId ? `/explore?sessionId=${payload.sessionId}` : "/explore",
    },
    icon: "/favicon.ico",
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
