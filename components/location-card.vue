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
    class="card card-compact bg-base-200 h-40 shrink-0 cursor-pointer border-2 mb-2 w-[250px]"
    :class="{
      'border-accent': isPointSelected(mapPoint, mapStore.selectedPoint),
      'border-transparent': !isPointSelected(mapPoint, mapStore.selectedPoint),
      'cursor-pointer': mapPoint.slug || mapPoint.id,
    }"
    @mouseleave="mapStore.selectedPoint = null"
    @mouseenter="mapStore.selectedPoint = mapPoint"
  >
    <div class="card-body">
      <slot name="top" />
      <h3 class="text-xl ellipsis line-clamp-1">
        {{ mapPoint.name }}
      </h3>
      <p class="ellipsis line-clamp-2">
        {{ mapPoint.description }}
      </p>
      <button
        v-if="mapStore.flyToPoint !== mapPoint"
        class="btn btn-primary"
        @click.prevent="mapStore.flyToPoint = mapPoint"
      >
        <span>Перейти к месту на карте</span>
      </button>
      <button
        v-else
        class="btn btn-accent"
        @click.prevent="mapStore.flyToPoint = null"
      >
        <span>Сбросить</span>
      </button>
    </div>
  </NuxtLink>
</template>
