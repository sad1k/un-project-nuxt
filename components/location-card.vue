<script lang="ts" setup>
import type { MapPoint } from "~/lib/types";

const { mapPoint } = defineProps<{
  mapPoint: MapPoint;
}>();

const mapStore = useMapStore();
</script>

<template>
  <NuxtLink
    :key="mapPoint.id"
    :to="mapPoint.to"
    class="card card-compact bg-white border border-gray-200 dark:bg-white/5 dark:backdrop-blur-sm dark:border-white/10 hover:border-brand-gold h-48 shrink-0 cursor-pointer transition-all duration-300 w-[280px] shadow-lg hover:shadow-xl group"
    :class="{
      'border-brand-gold ring-1 ring-brand-gold': isPointSelected(mapPoint, mapStore.selectedPoint),
    }"
    @mouseleave="mapStore.selectedPoint = null"
    @mouseenter="mapStore.selectedPoint = mapPoint"
  >
    <div class="card-body">
      <slot name="top" />
      <h3 class="text-xl ellipsis line-clamp-1 font-headline text-gray-900 dark:text-white group-hover:text-brand-gold transition-colors">
        {{ mapPoint.name }}
      </h3>
      <p class="ellipsis line-clamp-2 text-gray-500 dark:text-gray-400 font-light text-sm">
        {{ mapPoint.description }}
      </p>
      <div class="card-actions justify-end mt-auto">
        <button
          v-if="mapStore.flyToPoint !== mapPoint"
          class="btn btn-sm bg-brand-emerald text-white border-none hover:bg-white hover:text-brand-dark w-full font-bold"
          @click.prevent="mapStore.flyToPoint = mapPoint"
        >
          <span>View on Map</span>
        </button>
        <button
          v-else
          class="btn btn-sm btn-ghost text-gray-400 hover:text-white w-full"
          @click.prevent="mapStore.flyToPoint = null"
        >
          <span>Reset View</span>
        </button>
      </div>
    </div>
  </NuxtLink>
</template>
