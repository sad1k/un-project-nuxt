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
  const method = normalizeMethod(options?.method, request);
  if (method !== "GET")
    return true;

  const rawUrl = getRequestUrl(request);
  if (!rawUrl || !import.meta.client)
    return false;

  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin)
      return false;

    return isAppDataRequest(url.pathname);
  }
  catch {
    return rawUrl.startsWith("/api/");
  }
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

function isAppDataRequest(pathname: string) {
  return pathname.startsWith("/api/")
    || pathname.startsWith("/auth/")
    || pathname.endsWith(".json");
}
