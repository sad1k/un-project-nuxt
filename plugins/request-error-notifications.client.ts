type RequestFailureNotifier = ReturnType<typeof useRequestErrorNotifications>["notifyRequestError"];
type FetchLike = {
  (request: unknown, options?: { method?: string }): Promise<unknown>;
  create?: (defaults: unknown, globalOptions?: unknown) => FetchLike;
  native?: typeof fetch;
  raw?: (request: unknown, options?: { method?: string }) => Promise<unknown>;
};

export default defineNuxtPlugin({
  enforce: "post",
  name: "request-error-notifications",
  setup(nuxtApp) {
    const { notifyRequestError } = useRequestErrorNotifications();

    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = wrapNativeFetch(originalFetch, notifyRequestError);

    const globalWithFetch = globalThis as typeof globalThis & { $fetch?: FetchLike };
    if (globalWithFetch.$fetch)
      Reflect.set(globalThis, "$fetch", wrapOfetch(globalWithFetch.$fetch, "$fetch", notifyRequestError));

    const appWithCsrfFetch = nuxtApp as typeof nuxtApp & { $csrfFetch?: FetchLike };
    if (appWithCsrfFetch.$csrfFetch) {
      const csrfFetch = wrapOfetch(appWithCsrfFetch.$csrfFetch, "$csrfFetch", notifyRequestError);
      Reflect.set(nuxtApp, "$csrfFetch", csrfFetch);
      Reflect.set(nuxtApp.vueApp.config.globalProperties, "$csrfFetch", csrfFetch);
    }
  },
});

function wrapNativeFetch(fetcher: typeof fetch, notifyRequestError: RequestFailureNotifier): typeof fetch {
  return (async (request, init) => {
    try {
      const response = await fetcher(request, init);
      if (!response.ok && shouldNotifyRequestFailure(request, init)) {
        notifyRequestError({
          method: init?.method,
          request,
          source: "fetch",
          statusCode: response.status,
          statusText: response.statusText,
        });
      }
      return response;
    }
    catch (error) {
      if (shouldNotifyRequestFailure(request, init)) {
        notifyRequestError({
          error,
          method: init?.method,
          request,
          source: "fetch",
        });
      }
      throw error;
    }
  }) as typeof fetch;
}

function wrapOfetch(fetcher: FetchLike, source: "$fetch" | "$csrfFetch", notifyRequestError: RequestFailureNotifier): FetchLike {
  const wrapped = (async (request: unknown, options?: { method?: string }) => {
    try {
      return await fetcher(request, options);
    }
    catch (error) {
      if (shouldNotifyRequestFailure(request, options)) {
        notifyRequestError({
          error,
          method: options?.method,
          request,
          source,
        });
      }
      throw error;
    }
  }) as FetchLike;

  if (fetcher.raw) {
    wrapped.raw = async (request: unknown, options?: { method?: string }) => {
      try {
        return await fetcher.raw?.(request, options);
      }
      catch (error) {
        if (shouldNotifyRequestFailure(request, options)) {
          notifyRequestError({
            error,
            method: options?.method,
            request,
            source,
          });
        }
        throw error;
      }
    };
  }

  wrapped.native = fetcher.native;
  if (fetcher.create) {
    wrapped.create = (defaults: unknown, globalOptions?: unknown) =>
      wrapOfetch(fetcher.create?.(defaults, globalOptions) ?? fetcher, source, notifyRequestError);
  }

  return wrapped;
}

function shouldNotifyRequestFailure(request: unknown, options?: { method?: string }) {
  // The AI route stream renders its own tailored failure toast
  // (composables/use-ai-route-session.ts), so skip the generic notifier here to
  // avoid two toasts for a single generation failure.
  if (isRouteStreamRequest(request))
    return false;

  if (!import.meta.client)
    return false;

  const rawUrl = getRequestUrl(request);
  if (!rawUrl)
    return false;

  const url = parseRequestUrl(rawUrl);
  if (!url) {
    // Unparseable URL: only surface it when it clearly targets our own API and
    // is not a best-effort enrichment endpoint.
    return rawUrl.startsWith("/api/") && !isBestEffortRequest(rawUrl);
  }

  // Third-party / cross-origin requests (Mapbox telemetry + tiles, map and
  // provider CDNs, analytics, …) fail for reasons outside the app's control —
  // most visibly the Mapbox `events.mapbox.com` telemetry POSTs that fail in
  // dev — and must never raise a "Запрос не выполнен" toast. Only same-origin
  // app requests are actionable by the user.
  if (url.origin !== window.location.origin)
    return false;

  // Best-effort enrichment endpoints (place photos, place intelligence, place
  // stories, weather tips) proxy third-party providers and degrade gracefully
  // in the UI, so a failed fetch is expected background noise — not an error
  // worth interrupting the user with a toast.
  if (isBestEffortRequest(url.pathname))
    return false;

  const method = normalizeMethod(options?.method, request);
  // Same-origin mutations (saving a place, etc.) are always worth surfacing.
  if (method !== "GET")
    return true;

  // Same-origin reads: only surface real app-data endpoints (skip assets/HMR).
  return isAppDataRequest(url.pathname);
}

function normalizeMethod(method: string | undefined, request: unknown) {
  if (method)
    return method.toUpperCase();

  if (request instanceof Request)
    return request.method.toUpperCase();

  return "GET";
}

function getRequestUrl(request: unknown) {
  if (typeof request === "string")
    return request;

  if (request instanceof URL)
    return request.toString();

  if (request instanceof Request)
    return request.url;

  return "";
}

function parseRequestUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl, window.location.origin);
  }
  catch {
    return null;
  }
}

function isAppDataRequest(pathname: string) {
  return pathname.startsWith("/api/")
    || pathname.startsWith("/auth/")
    || pathname.endsWith(".json");
}

// Enrichment endpoints that proxy third-party providers (Google / Wikimedia /
// 2GIS photos, place intelligence, AI place stories, weather tips). They are
// best-effort: the UI falls back to an "unavailable" state when they fail, so
// their failures must never raise a global request-error toast.
const BEST_EFFORT_REQUEST_PATHS = [
  "/api/explore/place-photo",
  "/api/explore/place-intelligence",
  "/api/explore/place-story",
  "/api/explore/weather-tips",
];

function isBestEffortRequest(pathnameOrUrl: string) {
  return BEST_EFFORT_REQUEST_PATHS.some(path => pathnameOrUrl.startsWith(path));
}

function isRouteStreamRequest(request: unknown) {
  const rawUrl = getRequestUrl(request);
  if (!rawUrl)
    return false;

  try {
    const url = new URL(rawUrl, import.meta.client ? window.location.origin : "http://localhost");
    return url.pathname === "/api/ai/route";
  }
  catch {
    return rawUrl.startsWith("/api/ai/route");
  }
}
