<script setup lang="ts">
const { isOffline, isCaptivePortal } = useNetworkStatus();
const store = usePendingOperationsStore();
const open = ref(false);

const message = computed(() => {
  if (isCaptivePortal.value)
    return "Wi-Fi требует входа — откройте страницу провайдера, чтобы синхронизировать";
  if (isOffline.value)
    return `Офлайн — ${store.pendingCount} операций в очереди`;
  if (store.blockedCount > 0)
    return `${store.blockedCount} операций требуют внимания`;
  return "";
});

const visible = computed(() => Boolean(message.value));
const colorClass = computed(() => {
  if (store.blockedCount > 0)
    return "bg-red-500/95 text-red-50";
  if (isCaptivePortal.value)
    return "bg-orange-500/95 text-orange-50";
  return "bg-amber-500/95 text-amber-50";
});
</script>

<template>
  <div>
    <div
      v-if="visible"
      class="sticky top-0 z-40 cursor-pointer px-4 py-2 text-sm shadow-md"
      :class="[colorClass]"
      role="alert"
      @click="open = true"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="truncate">{{ message }}</span>
        <Icon name="lucide:chevron-right" class="size-4 shrink-0" />
      </div>
    </div>
    <OfflineSyncDrawer v-model="open" />
  </div>
</template>
