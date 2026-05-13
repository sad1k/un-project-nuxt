type RouteGenerationNotificationPayload = {
  sessionId: number;
  variantId: number;
  status: "completed" | "failed";
  title: string;
  body: string;
};

const lastNotification = ref<RouteGenerationNotificationPayload | null>(null);
const browserNotificationsEnabled = ref(false);
const browserNotificationError = ref<string | null>(null);
let notificationWatcherInstalled = false;

const NOTIFIED_VARIANTS_STORAGE_KEY = "wanderlog.routeGeneration.notifiedVariants";

function installRouteGenerationNotificationWatcher() {
  if (!import.meta.client || notificationWatcherInstalled)
    return;

  notificationWatcherInstalled = true;
  const { sessions } = useRouteGenerationStatus();

  watch(
    sessions,
    (nextSessions) => {
      for (const session of nextSessions) {
        if (!session.variantId || session.notificationStatus !== "pending")
          continue;

        if (session.status !== "completed" && session.status !== "failed")
          continue;

        const notifiedKey = `${session.sessionId}:${session.variantId}:${session.status}`;
        if (readNotifiedVariants().has(notifiedKey))
          continue;

        const payload = {
          body: session.status === "completed"
            ? `${session.pointCount} route points are ready.`
            : "Route generation needs attention.",
          sessionId: session.sessionId,
          status: session.status,
          title: session.title || session.cityName || "WanderLog route",
          variantId: session.variantId,
        } satisfies RouteGenerationNotificationPayload;

        emitRouteGenerationNotification(payload);
        rememberNotifiedVariant(notifiedKey);
        void markRouteGenerationNotificationStatus(session.sessionId, session.variantId, "delivered");
      }
    },
    { deep: true },
  );
}

async function requestRouteGenerationNotifications() {
  if (!import.meta.client || !("Notification" in window)) {
    browserNotificationError.value = "Browser notifications are not supported.";
    return false;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  browserNotificationsEnabled.value = permission === "granted";
  if (!browserNotificationsEnabled.value)
    return false;

  await registerRouteGenerationPushSubscription();
  return true;
}

async function registerRouteGenerationPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return;

  const config = useRuntimeConfig();
  const vapidPublicKey = config.public.routeNotificationVapidPublicKey;
  if (!vapidPublicKey)
    return;

  try {
    const registration = await navigator.serviceWorker.register("/route-generation-sw.js");
    const subscription = await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true,
    });
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys?.auth || !subscriptionJson.keys.p256dh)
      return;

    const { csrf } = useCsrf();
    await $fetch("/api/notifications/route-generation-subscription", {
      body: {
        endpoint: subscriptionJson.endpoint,
        keys: {
          auth: subscriptionJson.keys.auth,
          p256dh: subscriptionJson.keys.p256dh,
        },
        userAgent: navigator.userAgent,
      },
      headers: csrf ? { "csrf-token": csrf } : undefined,
      method: "POST",
    });
  }
  catch (caughtError) {
    console.error("[useRouteGenerationNotifications] Push subscription registration failed", caughtError);
    browserNotificationError.value = "Browser push notifications could not be enabled.";
  }
}

function emitRouteGenerationNotification(payload: RouteGenerationNotificationPayload) {
  lastNotification.value = payload;
  window.dispatchEvent(new CustomEvent("wanderlog:route-generation-notification", { detail: payload }));

  if (!("Notification" in window) || Notification.permission !== "granted")
    return;

  try {
    const notification = new Notification(
      payload.status === "completed" ? "Route ready" : "Route generation failed",
      {
        body: payload.body,
        icon: "/favicon.ico",
        tag: `route-generation:${payload.variantId}`,
      },
    );

    notification.onclick = () => {
      window.focus();
      void navigateTo({ path: "/explore", query: { sessionId: payload.sessionId } });
    };
  }
  catch (caughtError) {
    console.error("[useRouteGenerationNotifications] Browser notification failed", caughtError);
  }
}

async function markRouteGenerationNotificationStatus(
  sessionId: number,
  variantId: number,
  notificationStatus: "delivered" | "failed" | "dismissed",
) {
  const { csrf } = useCsrf();
  await $fetch("/api/notifications/route-generation-status", {
    body: {
      notificationStatus,
      sessionId,
      variantId,
    },
    headers: csrf ? { "csrf-token": csrf } : undefined,
    method: "POST",
  });
}

async function dismissRouteGenerationNotification() {
  const notification = lastNotification.value;
  lastNotification.value = null;

  if (notification) {
    await markRouteGenerationNotificationStatus(
      notification.sessionId,
      notification.variantId,
      "dismissed",
    );
  }
}

function readNotifiedVariants() {
  const stored = window.localStorage.getItem(NOTIFIED_VARIANTS_STORAGE_KEY);
  if (!stored)
    return new Set<string>();

  try {
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : []);
  }
  catch {
    return new Set<string>();
  }
}

function rememberNotifiedVariant(key: string) {
  const variants = readNotifiedVariants();
  variants.add(key);
  window.localStorage.setItem(NOTIFIED_VARIANTS_STORAGE_KEY, JSON.stringify([...variants].slice(-50)));
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1)
    output[index] = rawData.charCodeAt(index);

  return output;
}

export function useRouteGenerationNotifications() {
  installRouteGenerationNotificationWatcher();

  return {
    browserNotificationError,
    browserNotificationsEnabled,
    dismissRouteGenerationNotification,
    lastNotification,
    requestRouteGenerationNotifications,
  };
}
