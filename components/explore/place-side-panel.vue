<script setup lang="ts">
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{
  place: RouteMapPoint | null;
  intelligence: PlaceIntelligence | null;
  // Granular per-section flags (photo vs details), forwarded as-is to ExplorePlaceDetail.
  loading: { details?: boolean; photo?: boolean };
  editable?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
  story: [point: RouteMapPoint];
  edit: [point: RouteMapPoint];
  delete: [point: RouteMapPoint];
}>();

const isOpen = computed(() => Boolean(props.place));

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value)
    emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Transition name="place-panel">
    <aside
      v-if="isOpen && place"
      class="place-side-panel explore-popover fixed left-0 top-0 z-[60] hidden h-dvh w-[min(384px,92vw)] flex-col overflow-hidden border-r md:flex"
      role="dialog"
      aria-modal="false"
      :aria-label="`Детали места: ${place.name}`"
    >
      <button
        type="button"
        class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition hover:scale-105"
        style="background: var(--explore-popup-backdrop); color: var(--explore-text)"
        aria-label="Закрыть"
        @click="emit('close')"
      >
        <Icon name="tabler:x" size="18" />
      </button>

      <ExplorePlaceDetail
        :place="place"
        :intelligence="intelligence"
        :loading="loading"
        :editable="editable"
        @save="emit('save', $event)"
        @directions="emit('directions', $event)"
        @story="emit('story', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
      />
    </aside>
  </Transition>
</template>

<style scoped>
.place-side-panel {
  background: var(--explore-surface-strong);
  color: var(--explore-text);
  border-color: var(--explore-border);
  box-shadow: 16px 0 48px var(--explore-overlay-shadow);
}

.place-panel-enter-active,
.place-panel-leave-active {
  transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1);
}
.place-panel-enter-from,
.place-panel-leave-to {
  transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .place-panel-enter-active,
  .place-panel-leave-active {
    transition: opacity 160ms ease;
  }
  .place-panel-enter-from,
  .place-panel-leave-to {
    transform: none;
    opacity: 0;
  }
}
</style>
