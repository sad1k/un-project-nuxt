/**
 * Sends a postMessage to the active service worker requesting that the
 * provided URL entries be removed from the `wl-api-v1` runtime cache.
 *
 * Used after a successful mutation to drop stale cached GET responses so the
 * next read goes to the network and reflects the fresh data.
 */
export function useCacheInvalidate() {
  async function invalidateApiCache(urls: string[]) {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "wl-invalidate-cache", urls });
  }

  async function clearUserCache() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "wl-clear-user-cache" });
  }

  return { invalidateApiCache, clearUserCache };
}
