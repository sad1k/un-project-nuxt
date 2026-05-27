<script lang="ts" setup>
// Top-center pill banner that announces the offline state. Pure
// informational — never blocks input or shifts layout. Mounted
// once on the explore page; renders nothing while online.

const { isOffline } = useOnline();
const offlineRegions = useOfflineRegions();

const availableRegions = computed(() =>
  offlineRegions.regions.value.filter(region => region.status === "complete").length,
);

const detailText = computed(() => {
  if (!offlineRegions.isLoaded.value)
    return "загрузка списка регионов…";
  if (availableRegions.value === 0)
    return "карты для офлайна не скачаны";
  if (availableRegions.value === 1)
    return "1 регион доступен";
  return `${availableRegions.value} регионов доступно`;
});
</script>

<template>
  <Transition name="offline-banner">
    <div
      v-if="isOffline"
      class="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3"
      style="top: max(0.5rem, env(safe-area-inset-top))"
    >
      <div
        class="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-[var(--explore-warning-bg)] px-4 py-1.5 text-xs font-bold shadow-lg backdrop-blur-xl"
        style="border-color: var(--explore-warning-border); color: var(--explore-warning-text)"
        role="status"
        aria-live="polite"
      >
        <Icon name="tabler:wifi-off" size="14" />
        <span>Офлайн режим</span>
        <span class="opacity-75">· {{ detailText }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner-enter-active,
.offline-banner-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-banner-enter-from,
.offline-banner-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
