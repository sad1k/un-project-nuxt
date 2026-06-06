// Dev-only safety net: aggressively unregister any leftover service worker
// and purge SW caches.
//
// Why this exists: the production PWA service worker (`public/wanderlog-sw.js`)
// caches `/_nuxt/*` with StaleWhileRevalidate. Once registered (from a prod
// build, or from an earlier dev session before `pwa.devOptions.enabled` was
// disabled), it survives across `pnpm dev` runs and serves stale modules in
// front of Vite's HMR — which is why code changes "don't apply" until you
// clear the site data manually. This plugin makes that one-click-fix automatic.
//
// In production this plugin is a no-op — `@vite-pwa/nuxt` registers the SW
// later through its own client entry.
export default defineNuxtPlugin({
  name: "disable-sw-in-dev",
  parallel: true,
  async setup() {
    if (!import.meta.dev)
      return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const hadSw = regs.length > 0;
      await Promise.all(regs.map(r => r.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => k.startsWith("wl-") || k.startsWith("workbox-"))
            .map(k => caches.delete(k)),
        );
      }

      // Reload once so the page boots without the (now-unregistered) SW
      // intercepting requests. Guard against reload loops.
      const FLAG = "wl-dev-sw-killed";
      if (hadSw && !sessionStorage.getItem(FLAG)) {
        sessionStorage.setItem(FLAG, "1");
        window.location.reload();
      }
    }
    catch (error) {
      console.warn("[dev] disable-sw-in-dev: failed to clean up SW", error);
    }
  },
});
