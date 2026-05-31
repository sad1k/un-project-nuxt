<script setup lang="ts">
const { needsIosA2HS } = usePwaInstall();
const DISMISS_KEY = "wanderlog.ios-a2hs.dismissed";
const dismissed = ref(true);

onMounted(() => {
  if (!import.meta.client)
    return;
  try {
    dismissed.value = window.localStorage.getItem(DISMISS_KEY) === "1";
  }
  catch {
    dismissed.value = false;
  }
});

function dismiss() {
  dismissed.value = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  }
  catch {
    // localStorage may be unavailable in private mode
  }
}
</script>

<template>
  <div
    v-if="needsIosA2HS && !dismissed"
    class="fixed inset-x-3 bottom-24 z-40 rounded-lg bg-teal-700 px-4 py-3 text-sm text-white shadow-xl"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <Icon name="lucide:share" class="size-5 shrink-0" />
      <div class="flex-1">
        <p class="font-medium">
          Добавьте WanderLog на главный экран
        </p>
        <p class="mt-1 text-xs text-teal-100">
          Нажмите <Icon name="lucide:share" class="inline size-3.5" /> → «На экран Домой», чтобы получать push-уведомления и работать офлайн.
        </p>
      </div>
      <button
        class="rounded p-1 hover:bg-white/10"
        aria-label="Закрыть"
        @click="dismiss"
      >
        <Icon name="lucide:x" class="size-4" />
      </button>
    </div>
  </div>
</template>
