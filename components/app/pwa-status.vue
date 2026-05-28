<script lang="ts" setup>
const isOffline = ref(false);
const hasServiceWorker = ref(false);
const updateReady = ref(false);

function refreshOnlineState() {
  isOffline.value = !window.navigator.onLine;
}

onMounted(async () => {
  refreshOnlineState();
  window.addEventListener("online", refreshOnlineState);
  window.addEventListener("offline", refreshOnlineState);

  if (!("serviceWorker" in navigator))
    return;

  const registration = await navigator.serviceWorker.getRegistration();
  hasServiceWorker.value = Boolean(registration || navigator.serviceWorker.controller);
  if (!registration)
    return;

  registration.addEventListener("updatefound", () => {
    updateReady.value = true;
  });

  if (registration.waiting)
    updateReady.value = true;
});

onBeforeUnmount(() => {
  if (!import.meta.client)
    return;

  window.removeEventListener("online", refreshOnlineState);
  window.removeEventListener("offline", refreshOnlineState);
});
</script>

<template>
  <div
    v-if="isOffline || updateReady"
    class="app-chrome-strong rounded-lg border px-3 py-2 text-xs backdrop-blur"
    aria-live="polite"
  >
    <p
      v-if="isOffline"
      class="flex items-center gap-2"
    >
      <Icon name="tabler:wifi-off" size="15" />
      <span>Офлайн-оболочка доступна. Скачанные регионы карты работают. Для маршрутов, дневника и AI нужна сеть.</span>
    </p>
    <p
      v-else-if="updateReady"
      class="flex items-center gap-2"
    >
      <Icon name="tabler:refresh" size="15" />
      <span>Обновление приложения готово. Обновите страницу, когда удобно.</span>
    </p>
    <span
      v-if="hasServiceWorker"
      class="sr-only"
    >Service worker активен</span>
  </div>
</template>
