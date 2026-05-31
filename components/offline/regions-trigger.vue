<script lang="ts" setup>
// Mini floating button that opens the offline-regions manager.
// Only visible when the user actually has saved regions — otherwise
// the entry point is irrelevant.

defineEmits<{
  open: [];
}>();

const offlineRegions = useOfflineRegions();
const count = computed(() => offlineRegions.regions.value.length);
const visible = computed(() => offlineRegions.isLoaded.value && count.value > 0);
</script>

<template>
  <Transition name="offline-trigger">
    <button
      v-if="visible"
      type="button"
      class="explore-control pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-lg backdrop-blur-xl transition-all hover:text-brand-gold"
      :aria-label="`Открыть сохранённые офлайн-регионы (${count})`"
      @click="$emit('open')"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--explore-success-bg)] text-[var(--explore-success-text)]">
        <Icon name="tabler:cloud-check" size="14" />
      </span>
      <span class="flex flex-col items-start leading-tight">
        <span class="text-xs font-bold text-[var(--explore-text)]">
          Офлайн-регионы
        </span>
        <span class="font-mono text-[10px] text-[var(--explore-text-soft)]">
          {{ count }} сохранено
        </span>
      </span>
    </button>
  </Transition>
</template>

<style scoped>
.offline-trigger-enter-active,
.offline-trigger-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-trigger-enter-from,
.offline-trigger-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
