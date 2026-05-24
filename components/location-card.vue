<script lang="ts" setup>
import type { MapPoint } from "~/lib/types";

const { mapPoint } = defineProps<{
  mapPoint: MapPoint;
}>();

const mapStore = useMapStore();
const colorMode = useColorMode();
const config = useRuntimeConfig();

const selected = computed(() => isPointSelected(mapPoint, mapStore.selectedPoint));

const hasCoords = computed(() =>
  Number.isFinite(mapPoint.lat)
  && Number.isFinite(mapPoint.long)
  && Math.abs(mapPoint.lat) <= 90
  && Math.abs(mapPoint.long) <= 180,
);

const mapPreviewUrl = computed(() => {
  const token = config.public.mapboxToken;
  if (!token || !hasCoords.value)
    return null;
  const style = colorMode.value === "light" ? "outdoors-v12" : "dark-v11";
  const lon = mapPoint.long.toFixed(5);
  const lat = mapPoint.lat.toFixed(5);
  const pin = `pin-s+f3d19e(${lon},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${pin}/${lon},${lat},12,0/320x160@2x?access_token=${token}&logo=false&attribution=false`;
});

const initial = computed(() => (mapPoint.name?.trim()?.[0] ?? "•").toUpperCase());

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
    :title="`Открыть «${mapPoint.name}»`"
    class="group relative flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm motion-safe:transition-all motion-safe:duration-300 active:scale-[0.98] active:bg-gray-50 md:w-[280px] md:flex-col md:p-0 md:gap-0 md:hover:-translate-y-1 md:hover:border-brand-gold/40 md:hover:shadow-xl md:hover:shadow-black/30 dark:border-white/10 dark:bg-white/5 dark:active:bg-white/10"
    :class="selected ? 'border-l-4 border-l-brand-gold' : ''"
  >
    <div class="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-emerald/40 to-brand-sangria/40 md:h-32 md:w-full md:rounded-b-none md:rounded-t-2xl">
      <img
        v-if="mapPoint.imageUrl"
        :src="mapPoint.imageUrl"
        :alt="mapPoint.name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
      <img
        v-else-if="mapPreviewUrl"
        :src="mapPreviewUrl"
        :alt="`Карта: ${mapPoint.name}`"
        loading="lazy"
        width="640"
        height="320"
        class="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-[1.04]"
      >
      <div v-else class="flex h-full w-full items-center justify-center font-display text-white/90">
        <span class="text-2xl font-semibold md:text-5xl">{{ initial }}</span>
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/40 to-transparent md:h-10" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-1 md:p-3">
      <slot name="top" />
      <h3 class="line-clamp-1 text-base font-semibold tracking-tight text-gray-900 md:text-lg dark:text-white">
        {{ mapPoint.name }}
      </h3>
      <p v-if="mapPoint.description" class="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
        {{ mapPoint.description }}
      </p>
    </div>
    <div class="flex shrink-0 items-center justify-center md:hidden">
      <button
        type="button"
        aria-label="Показать на карте"
        title="Показать это место на карте"
        class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border"
        @click="showOnMap"
      >
        <Icon name="tabler:map-pin" size="18" />
      </button>
    </div>
  </NuxtLink>
</template>
