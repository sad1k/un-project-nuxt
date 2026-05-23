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
    class="card card-compact h-48 w-full shrink-0 cursor-pointer border border-gray-200 bg-white/80 shadow-2xl shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold hover:bg-amber-50/70 sm:w-[280px] group dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    :class="{
      'border-brand-gold ring-1 ring-brand-gold': isPointSelected(mapPoint, mapStore.selectedPoint),
    }"
    @mouseleave="mapStore.selectedPoint = null"
    @mouseenter="mapStore.selectedPoint = mapPoint"
  >
    <div class="card-body">
      <slot name="top" />
      <h3 class="text-xl ellipsis line-clamp-1 font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-brand-gold transition-colors">
        {{ mapPoint.name }}
      </h3>
      <p class="ellipsis line-clamp-2 text-gray-500 dark:text-gray-400 font-light text-sm">
        {{ mapPoint.description }}
      </p>
      <div class="card-actions justify-end mt-auto">
        <button
          v-if="mapStore.flyToPoint !== mapPoint"
          class="btn btn-sm w-full border-none bg-brand-emerald font-bold text-white transition hover:bg-white hover:text-brand-dark"
          @click.prevent="mapStore.flyToPoint = mapPoint"
        >
          <span>Перейти к месту</span>
        </button>
        <button
          v-else
          class="btn btn-sm btn-ghost text-gray-500 hover:text-gray-950 w-full dark:text-gray-400 dark:hover:text-white"
          @click.prevent="mapStore.flyToPoint = null"
        >
          <span>Сбросить вид</span>
        </button>
      </div>
    </div>
  </NuxtLink>
</template>
