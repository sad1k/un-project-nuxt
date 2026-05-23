type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_STORAGE_KEY = "wanderlog.pwaInstallPrompt.dismissed";
const deferredInstallPrompt = shallowRef<BeforeInstallPromptEvent | null>(null);
const installPromptDismissed = ref(false);
const installPromptInstalled = ref(false);
let installPromptListenersReady = false;

export function usePwaInstallPrompt() {
  if (import.meta.client && !installPromptListenersReady)
    installInstallPromptListeners();

  const canInstall = computed(() => Boolean(deferredInstallPrompt.value)
    && !installPromptDismissed.value
    && !installPromptInstalled.value);

  async function install() {
    const promptEvent = deferredInstallPrompt.value;
    if (!promptEvent)
      return false;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredInstallPrompt.value = null;

    if (choice.outcome === "accepted") {
      installPromptInstalled.value = true;
      rememberDismissed();
      return true;
    }

    dismiss();
    return false;
  }

  function dismiss() {
    deferredInstallPrompt.value = null;
    rememberDismissed();
  }

  return {
    canInstall,
    dismiss,
    install,
    installPromptDismissed,
    installPromptInstalled,
  };
}

function installInstallPromptListeners() {
  installPromptListenersReady = true;
  installPromptDismissed.value = window.localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY) === "true";

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (installPromptDismissed.value || installPromptInstalled.value)
      return;

    deferredInstallPrompt.value = event as BeforeInstallPromptEvent;
  });

  window.addEventListener("appinstalled", () => {
    installPromptInstalled.value = true;
    rememberDismissed();
  });
}

function rememberDismissed() {
  installPromptDismissed.value = true;
  if (import.meta.client)
    window.localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, "true");
}
