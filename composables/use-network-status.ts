type HeartbeatResult = "online" | "offline" | "captive_portal";

type HeartbeatInput = {
  ok: boolean;
  status: number;
  contentType: string | null;
  error?: boolean;
};

export function interpretHeartbeat(input: HeartbeatInput): HeartbeatResult {
  if (input.error || input.status === 0)
    return "offline";
  if (input.status >= 500)
    return "offline";
  if (!input.ok)
    return "offline";
  if (input.contentType && input.contentType.includes("application/json"))
    return "online";
  if (input.contentType && input.contentType.includes("text/html"))
    return "captive_portal";
  return "offline";
}

const status = ref<HeartbeatResult>("online");
const lastChange = ref(Date.now());
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let stabilityTimer: ReturnType<typeof setTimeout> | null = null;

async function probe(): Promise<HeartbeatResult> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/health", {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    return interpretHeartbeat({
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
    });
  }
  catch {
    return interpretHeartbeat({ ok: false, status: 0, contentType: null, error: true });
  }
}

function setStatusWithDebounce(next: HeartbeatResult) {
  if (next === status.value)
    return;
  // Online → require 3s stability before flipping (captive portal / flapping connection guard)
  if (next === "online" && status.value !== "online") {
    if (stabilityTimer)
      clearTimeout(stabilityTimer);
    stabilityTimer = setTimeout(() => {
      status.value = next;
      lastChange.value = Date.now();
      window.dispatchEvent(new CustomEvent("wl:network-changed", { detail: next }));
    }, 3000);
    return;
  }
  // Offline / captive → flip immediately
  if (stabilityTimer) {
    clearTimeout(stabilityTimer);
    stabilityTimer = null;
  }
  status.value = next;
  lastChange.value = Date.now();
  window.dispatchEvent(new CustomEvent("wl:network-changed", { detail: next }));
}

function start() {
  if (!import.meta.client || heartbeatTimer)
    return;
  setStatusWithDebounce(navigator.onLine ? "online" : "offline");
  window.addEventListener("online", () => probe().then(setStatusWithDebounce));
  window.addEventListener("offline", () => setStatusWithDebounce("offline"));
  // Probe every 30 seconds when window visible (captive portal / silent disconnect detection)
  heartbeatTimer = setInterval(async () => {
    if (document.visibilityState !== "visible")
      return;
    setStatusWithDebounce(await probe());
  }, 30_000);
}

export function useNetworkStatus() {
  if (import.meta.client)
    start();
  return {
    status: readonly(status),
    lastChange: readonly(lastChange),
    isOnline: computed(() => status.value === "online"),
    isOffline: computed(() => status.value === "offline" || status.value === "captive_portal"),
    isCaptivePortal: computed(() => status.value === "captive_portal"),
    probe,
  };
}
