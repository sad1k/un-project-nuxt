<script lang="ts" setup>
import type { MapPoint } from "~/lib/types";

const { mapPoint } = defineProps<{
  mapPoint: MapPoint;
}>();

const mapStore = useMapStore();

const selected = computed(() => isPointSelected(mapPoint, mapStore.selectedPoint));

function showOnMap(e: Event) {
  e.preventDefault();
  mapStore.flyToPoint = mapPoint;
  mapStore.showMapPeek?.();
}
</script>

<template>
  <NuxtLink
    :key="mapPoint.id"
    :to="mapPoint.to"
    class="group relative flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm motion-safe:transition-transform active:scale-[0.98] active:bg-gray-50 md:h-48 md:w-[280px] md:flex-col md:p-0 md:items-stretch md:gap-0 dark:border-white/10 dark:bg-white/5 dark:active:bg-white/10"
    :class="selected ? 'border-l-4 border-l-brand-gold' : ''"
  >
    <div class="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-emerald/30 to-brand-sangria/30 md:h-32 md:w-full md:rounded-b-none md:rounded-t-2xl">
      <img
        v-if="mapPoint.imageUrl"
        :src="mapPoint.imageUrl"
        :alt="mapPoint.name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
      <div v-else class="flex h-full w-full items-center justify-center text-white/80">
        <Icon name="tabler:map-pin" size="28" />
      </div>
    </div>
    <div class="flex min-w-0 flex-1 flex-col justify-center md:p-3">
      <slot name="top" />
      <h3 class="line-clamp-1 text-base font-semibold tracking-tight text-gray-900 md:text-xl dark:text-white">
        {{ mapPoint.name }}
      </h3>
      <p v-if="mapPoint.description" class="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
        {{ mapPoint.description }}
      </p>
    </div>
    <div class="flex shrink-0 flex-col items-center justify-center gap-1 md:hidden">
      <button
        type="button"
        aria-label="Показать на карте"
        class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border"
        @click="showOnMap"
      >
        <Icon name="tabler:map-pin" size="18" />
      </button>
      <Icon name="tabler:chevron-right" size="16" class="text-gray-400" />
    </div>
  </NuxtLink>
</template>
