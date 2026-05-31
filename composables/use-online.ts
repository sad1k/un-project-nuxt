// Module-level singleton: `navigator.onLine` exposed as a reactive ref.
// Listeners attach once on the first client-side `useOnline()` call and stay
// for the page lifetime — matches the pattern used by `useMapbox`.

const isOnlineState = ref(true);
let listenersAttached = false;

function ensureListeners() {
  if (listenersAttached || typeof window === "undefined")
    return;

  listenersAttached = true;
  isOnlineState.value = navigator.onLine;

  window.addEventListener("online", () => {
    isOnlineState.value = true;
  });
  window.addEventListener("offline", () => {
    isOnlineState.value = false;
  });
}

export function useOnline() {
  ensureListeners();
  const isOnline = readonly(isOnlineState);
  return {
    isOnline,
    isOffline: computed(() => !isOnline.value),
  };
}
