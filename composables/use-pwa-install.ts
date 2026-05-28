type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const installPromptEvent = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(false);
const iosStandalone = ref(false);
const isIos = ref(false);

let listenerInstalled = false;

function installListeners() {
  if (!import.meta.client || listenerInstalled)
    return;
  listenerInstalled = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPromptEvent.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installed.value = true;
    installPromptEvent.value = null;
  });

  const ua = navigator.userAgent.toLowerCase();
  isIos.value = /iphone|ipad|ipod/.test(ua);
  // iOS Safari exposes navigator.standalone when launched from home screen
  iosStandalone.value = Boolean((navigator as { standalone?: boolean }).standalone);
}

async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = installPromptEvent.value;
  if (!event)
    return "unavailable";
  await event.prompt();
  const choice = await event.userChoice;
  installPromptEvent.value = null;
  return choice.outcome;
}

export function usePwaInstall() {
  installListeners();
  const canInstall = computed(() => installPromptEvent.value !== null);
  const needsIosA2HS = computed(() => isIos.value && !iosStandalone.value && !installed.value);

  return {
    canInstall,
    needsIosA2HS,
    installed: readonly(installed),
    promptInstall,
  };
}
