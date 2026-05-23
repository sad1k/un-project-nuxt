import { toast } from "vue-sonner";

type RequestErrorNotificationInput = {
  error?: unknown;
  method?: string;
  request: unknown;
  source: "fetch" | "$fetch" | "$csrfFetch";
  statusCode?: number;
  statusText?: string;
};

export type RequestErrorNotification = {
  count: number;
  createdAt: number;
  groupKey: string;
  id: string;
  lastSeenAt: number;
  message: string;
  method: string;
  reported: boolean;
  reporting: boolean;
  requestLabel: string;
  source: RequestErrorNotificationInput["source"];
  statusCode?: number;
  statusText?: string;
  toastId: number | string;
};

type RequestErrorNotificationPatch = Partial<Omit<RequestErrorNotification, "groupKey">>;
const REQUEST_ERROR_SIGNAL_DEDUPE_MS = 100;

export function useRequestErrorNotifications() {
  const notificationGroups = useState<Record<string, RequestErrorNotification>>("request-error-notification-groups", () => ({}));

  function notifyRequestError(input: RequestErrorNotificationInput) {
    if (!import.meta.client)
      return;

    const method = normalizeMethod(input.method, input.request);
    const requestLabel = getRequestLabel(input.request);
    const statusCode = input.statusCode ?? getErrorStatusCode(input.error);
    const statusText = input.statusText ?? getErrorStatusText(input.error);
    const groupKey = `${method}:${requestLabel}:${statusCode ?? "network"}`;
    const now = Date.now();
    const existing = notificationGroups.value[groupKey];

    if (existing && now - existing.lastSeenAt < REQUEST_ERROR_SIGNAL_DEDUPE_MS) {
      setNotificationGroup(groupKey, {
        ...existing,
        lastSeenAt: now,
      });
      return;
    }

    const nextNotification: RequestErrorNotification = existing
      ? {
          ...existing,
          count: existing.count + 1,
          lastSeenAt: now,
          reported: false,
          reporting: false,
        }
      : {
          count: 1,
          createdAt: now,
          groupKey,
          id: `request-error-${now}-${Math.random().toString(36).slice(2, 8)}`,
          lastSeenAt: now,
          message: getRequestErrorMessage(statusCode),
          method,
          reported: false,
          reporting: false,
          requestLabel,
          source: input.source,
          statusCode,
          statusText,
          toastId: groupKey,
        };

    setNotificationGroup(groupKey, nextNotification);
    showRequestErrorToast(nextNotification);
  }

  function dismissRequestError(groupKey: string) {
    const notification = notificationGroups.value[groupKey];
    if (notification)
      toast.dismiss(notification.toastId);

    const { [groupKey]: _dismissed, ...rest } = notificationGroups.value;
    notificationGroups.value = rest;
  }

  async function reportRequestError(groupKey: string) {
    const notification = notificationGroups.value[groupKey];
    if (!notification || notification.reporting || notification.reported)
      return;

    updateNotification(groupKey, { reporting: true });

    try {
      const Sentry = await import("@sentry/nuxt");
      Sentry.captureMessage("User reported failed request", {
        extra: {
          method: notification.method,
          requestLabel: notification.requestLabel,
          source: notification.source,
          statusCode: notification.statusCode,
          statusText: notification.statusText,
          groupedCount: notification.count,
        },
        level: "error",
        tags: {
          feature: "global-request-notification",
        },
      });
      updateNotification(groupKey, { reported: true, reporting: false });
      toast.success("Ошибка отправлена", {
        id: notification.toastId,
        description: `${notification.method} ${notification.requestLabel}`,
      });
    }
    catch {
      updateNotification(groupKey, { reporting: false });
    }
  }

  function updateNotification(groupKey: string, patch: RequestErrorNotificationPatch) {
    const notification = notificationGroups.value[groupKey];
    if (!notification)
      return;

    const nextNotification = {
      ...notification,
      ...patch,
    };
    setNotificationGroup(groupKey, nextNotification);
  }

  return {
    dismissRequestError,
    notificationGroups,
    notifyRequestError,
    reportRequestError,
  };
}

function setNotificationGroup(groupKey: string, notification: RequestErrorNotification) {
  const notificationGroups = useState<Record<string, RequestErrorNotification>>("request-error-notification-groups", () => ({}));
  notificationGroups.value = {
    ...notificationGroups.value,
    [groupKey]: notification,
  };
}

function showRequestErrorToast(notification: RequestErrorNotification) {
  toast.error("Запрос не выполнен", {
    id: notification.toastId,
    action: {
      label: "Сообщить об ошибке",
      onClick: () => {
        void useRequestErrorNotifications().reportRequestError(notification.groupKey);
      },
    },
    description: getToastDescription(notification),
    duration: 12000,
    testId: "request-error-notification",
  });
}

function getToastDescription(notification: RequestErrorNotification) {
  const statusSuffix = notification.statusCode ? ` - ${notification.statusCode}` : "";
  const countPrefix = notification.count > 1 ? `Повторилось ${notification.count} раз. ` : "";
  return `${countPrefix}${notification.message}\n${notification.method} ${notification.requestLabel}${statusSuffix}`;
}

function normalizeMethod(method: string | undefined, request: unknown) {
  if (method)
    return method.toUpperCase();

  if (request instanceof Request)
    return request.method.toUpperCase();

  return "GET";
}

function getRequestLabel(request: unknown) {
  const rawUrl = getRequestUrl(request);
  if (!rawUrl)
    return "неизвестный запрос";

  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin === window.location.origin)
      return normalizeSameOriginRequestLabel(`${url.pathname}${url.search}`);

    return `${url.host}${normalizePathname(url.pathname)}${url.search}`;
  }
  catch {
    return normalizeSameOriginRequestLabel(rawUrl);
  }
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

function normalizeSameOriginRequestLabel(rawUrl: string) {
  const normalized = rawUrl.split("#", 1)[0] || rawUrl;

  if (!normalized)
    return "/";

  const [pathname, query = ""] = normalized.split("?", 2);
  const normalizedPathname = normalizePathname(pathname.startsWith("/") ? pathname : `/${pathname}`);
  return query ? `${normalizedPathname}?${query}` : normalizedPathname;
}

function normalizePathname(pathname: string) {
  if (pathname === "/")
    return pathname;

  return pathname.replace(/\/+$/, "");
}

function getErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object")
    return undefined;

  const candidate = error as {
    response?: { status?: number; statusCode?: number };
    status?: number;
    statusCode?: number;
  };

  return candidate.status
    ?? candidate.statusCode
    ?? candidate.response?.status
    ?? candidate.response?.statusCode;
}

function getErrorStatusText(error: unknown) {
  if (!error || typeof error !== "object")
    return undefined;

  const candidate = error as {
    response?: { statusText?: string; statusMessage?: string };
    statusMessage?: string;
    statusText?: string;
  };

  return candidate.statusText
    ?? candidate.statusMessage
    ?? candidate.response?.statusText
    ?? candidate.response?.statusMessage;
}

function getRequestErrorMessage(statusCode: number | undefined) {
  if (!statusCode)
    return "Сеть недоступна или запрос был прерван.";

  if (statusCode === 401 || statusCode === 403)
    return "Сессия или доступ к действию недействительны.";

  if (statusCode === 404)
    return "Запрошенные данные не найдены.";

  if (statusCode >= 500)
    return "Сервер не смог обработать запрос.";

  return "Запрос завершился с ошибкой.";
}
