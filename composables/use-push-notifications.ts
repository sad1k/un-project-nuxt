import type { PushSettings } from "~/lib/offline/operation-types";

import { getPushSettings, setPushSettings } from "~/lib/offline/idb";

export type PushType = "social" | "upload" | "reminders" | "route";

const enabled = ref(false);
const error = ref<string | null>(null);
const settings = ref<PushSettings>({ social: true, upload: true, reminders: false, route: true });

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1)
    output[i] = rawData.charCodeAt(i);
  return output;
}

async function loadStoredSettings() {
  if (!import.meta.client)
    return;
  const stored = await getPushSettings();
  if (stored)
    settings.value = stored;
}

function selectedTypes(): PushType[] {
  return (Object.keys(settings.value) as PushType[]).filter(k => settings.value[k]);
}

async function requestPermissionAndSubscribe(): Promise<boolean> {
  if (!import.meta.client) {
    error.value = "Браузерное окружение недоступно";
    return false;
  }
  if (!("Notification" in window)) {
    error.value = "Уведомления не поддерживаются в этом браузере";
    return false;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    error.value = "Push не поддерживается в этом браузере";
    return false;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") {
    error.value = "Разрешение на уведомления не получено";
    return false;
  }
  enabled.value = true;

  const config = useRuntimeConfig();
  const vapidPublicKey = config.public.routeNotificationVapidPublicKey;
  if (!vapidPublicKey) {
    error.value = "VAPID public key не настроен на сервере";
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/wanderlog-sw.js");
    const subscription = await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true,
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) {
      error.value = "Неверный формат push-подписки";
      return false;
    }

    const { csrf } = useCsrf();
    await $fetch("/api/notifications/push-subscription", {
      method: "POST",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      body: {
        endpoint: json.endpoint,
        keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
        types: selectedTypes(),
        userAgent: navigator.userAgent,
      },
    });
    await setPushSettings(settings.value);
    return true;
  }
  catch (caughtError) {
    console.error("[usePushNotifications] subscribe failed", caughtError);
    error.value = "Не удалось включить push-уведомления";
    return false;
  }
}

async function updateSettings(next: PushSettings) {
  settings.value = next;
  await setPushSettings(next);
  if (enabled.value)
    await requestPermissionAndSubscribe();
}

async function unsubscribeType(type: PushType) {
  const { csrf } = useCsrf();
  await $fetch(`/api/notifications/push-subscription/${type}`, {
    method: "DELETE",
    headers: csrf ? { "csrf-token": csrf } : undefined,
  });
  settings.value = { ...settings.value, [type]: false };
  await setPushSettings(settings.value);
}

export function usePushNotifications() {
  if (import.meta.client && Notification.permission === "granted")
    enabled.value = true;
  return {
    enabled: readonly(enabled),
    error: readonly(error),
    settings,
    loadStoredSettings,
    requestPermissionAndSubscribe,
    updateSettings,
    unsubscribeType,
  };
}
