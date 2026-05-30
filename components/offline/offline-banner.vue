<script setup lang="ts">
const props = defineProps<{
  // On the full-screen explore map the banner floats as a pill clear of the
  // side rail and search bar; elsewhere it stays a full-width sticky strip.
  floating?: boolean;
}>();

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

const layoutClass = computed(() => props.floating
  ? "absolute left-[72px] top-16 z-40 w-fit max-w-[calc(100vw-96px)] rounded-full py-1.5 shadow-lg ring-1 ring-black/10 backdrop-blur-xl max-md:left-3 sm:max-w-md"
  : "sticky top-0 z-40 py-2 shadow-md");
</script>

<template>
  <div>
    <div
      v-if="visible"
      class="cursor-pointer px-4 text-sm"
      :class="[colorClass, layoutClass]"
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
