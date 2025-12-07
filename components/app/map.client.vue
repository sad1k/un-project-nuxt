<script lang="ts" setup>
import type { MglEvent } from "@indoorequal/vue-maplibre-gl";
import type { LngLat } from "maplibre-gl";

import { CENTER_RUSSIA } from "~/lib/constants";

const mapStore = useMapStore();

const colorMode = useColorMode();
const style = computed(() => colorMode.value === "dark" ? "/styles/dark.json" : "https://tiles.openfreemap.org/styles/liberty");
const zoom = 4;

function updateAddedPoint(location: LngLat) {
  if (mapStore.addedPoint) {
    mapStore.addedPoint.lat = location.lat;
    mapStore.addedPoint.long = location.lng;
  }
}

onMounted(() => {
  mapStore.init();
});

function onDoubleClick(mglEvent: MglEvent<"dblclick">) {
  if (mapStore.addedPoint) {
    const event = mglEvent.event as { lngLat: { lat: number; lng: number } };
    mapStore.addedPoint.lat = event.lngLat.lat;
    mapStore.addedPoint.long = event.lngLat.lng;
  }
}
</script>

<template>
  <MglMap
    :map-style="style"
    :center="[CENTER_RUSSIA[0], CENTER_RUSSIA[1]] as [number, number]"
    :zoom="zoom"
    @map:dblclick="onDoubleClick"
  >
    <MglNavigationControl />
    <MglMarker
      v-if="mapStore.addedPoint"
      :coordinates="[mapStore.addedPoint.long, mapStore.addedPoint.lat]"
      :draggable="true"
      @update:coordinates="updateAddedPoint"
    >
      <template #marker>
        <div class="tooltip tooltip-top tooltip-open hover:cursor-pointer" data-tip="Перенесите на необходимое место">
          <Icon
            name="tabler:map-pin-filled"
            size="24"
            class="text-warning"
          />
        </div>
      </template>
    </MglMarker>

    <MglMarker
      v-for="point in mapStore.mapPoints"
      :key="point.id"
      :coordinates="[point.long, point.lat]"
    >
      <template #marker>
        <div
          class="tooltip hover:cursor-pointer"
          :data-tip="point.name"
          :class="{
            'tooltip-open': isPointSelected(point, mapStore.selectedPoint),
          }"
          @mouseenter="mapStore.selectedPoint = point"
          @mouseleave="mapStore.selectedPoint = null"
        >
          <Icon
            name="tabler:map-pin-filled"
            size="24"
            :class="isPointSelected(point, mapStore.selectedPoint) ? 'text-accent' : 'text-secondary'"
          />
        </div>
      </template>
      <MglPopup>
        <h3 class="text-sm">
          {{ point.name }}
        </h3>
        <p>{{ point.description }}</p>
        <div class="flex justify-end mt-2">
          <NuxtLink
            v-if="point.to"
            class="btn btn-primary"
            :to="point.to"
          >
            <Icon
              name="tabler:link"
              size="24"
              class="text-secondary"
            />
            {{ point.toLabel }}
          </NuxtLink>
        </div>
      </MglPopup>
    </MglMarker>
  </MglMap>
</template>
