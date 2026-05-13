<script lang="ts" setup>
import type { LngLat, YMap } from "@yandex/ymaps3-types";
import type { YMapLocationRequest } from "@yandex/ymaps3-types/imperative/YMap";
import type { MapEvent } from "@yandex/ymaps3-types/imperative/YMapFeature/types";
import type { Ref } from "vue";

import {
  YandexMap,
  YandexMapControls,
  YandexMapDefaultFeaturesLayer,
  YandexMapDefaultSchemeLayer,
  YandexMapListener,
  YandexMapPopupMarker,
  YandexMapUiMarker,
  YandexMapZoomControl,
} from "vue-yandex-maps";

import { createYndxMapAdapter } from "~/lib/map/yndxmap-adapter";

const colorMode = useColorMode();
const mapStore = useMapStore();

const tooltipVisible = ref(true);

// Default location (Moscow)
const defaultLocation: YMapLocationRequest = {
  center: [37.617644, 55.755819],
  zoom: 9,
};

// Create the map ref locally and pass it to the adapter
const mapRef = shallowRef<YMap | null>(null);
const fallbackLocationRef = ref<YMapLocationRequest>({ ...defaultLocation });

// Use adapter's location ref when available
const locationRef = computed<YMapLocationRequest>(() => {
  return (mapStore.adapter?.location as Ref<YMapLocationRequest> | undefined)?.value ?? fallbackLocationRef.value;
});

const mapSettings = computed(() => {
  return {
    location: locationRef.value,
    theme: colorMode.value as "dark" | "light",
  };
});

onMounted(async () => {
  // Pass the map ref to the adapter factory
  await mapStore.init(() => createYndxMapAdapter(mapRef));
});

function updateAddedPoint(location: LngLat) {
  if (mapStore.addedPoint) {
    mapStore.addedPoint.long = location[0];
    mapStore.addedPoint.lat = location[1];
    tooltipToggle();
  }
}

function onDoubleClick(mapEvent: MapEvent) {
  if (mapStore.addedPoint) {
    const coords = mapEvent.coordinates;
    mapStore.addedPoint.long = coords[0];
    mapStore.addedPoint.lat = coords[1];
  }
}

function tooltipToggle() {
  tooltipVisible.value = !tooltipVisible.value;
}
</script>

<template>
  <YandexMap
    v-model="mapRef"
    real-settings-location
    :settings="mapSettings"
  >
    <YandexMapDefaultSchemeLayer />
    <YandexMapDefaultFeaturesLayer />
    <YandexMapControls
      :settings="
        {
          position:
            'right',
        }"
    >
      <YandexMapZoomControl />
    </YandexMapControls>

    <YandexMapListener
      :settings="{
        onDblClick: (_, mapEvent) => onDoubleClick(mapEvent),
      }"
    />

    <template v-if="mapStore.addedPoint">
      <YandexMapUiMarker
        :settings="{ coordinates: [mapStore.addedPoint.long, mapStore.addedPoint.lat],
                     zIndex: 2,
                     draggable: true,
                     onDragStart: tooltipToggle,
                     onDragEnd: updateAddedPoint,
        }"
      />
      <YandexMapPopupMarker

        :settings="{ coordinates: [mapStore.addedPoint.long, mapStore.addedPoint.lat],
                     show: tooltipVisible,
                     zIndex: 2,
        }"
      >
        <h3 class="text-sm">
          Перенесите на необходимое место
          <Icon
            name="tabler:map-pin-filled"
            size="24"
            class="text-warning"
          />
        </h3>
      </YandexMapPopupMarker>
    </template>

    <template v-for="point in mapStore.mapPoints" :key="point.id">
      <YandexMapUiMarker
        :settings="{ coordinates: [point.long, point.lat],
                     onMouseEnter: () => mapStore.selectedPoint = point,
                     zIndex: mapStore.selectedPoint?.id === point.id ? 1 : 0,
                     onMouseLeave: () => mapStore.selectedPoint = null,
        }"
      />
      <YandexMapPopupMarker
        :settings="{ coordinates: [point.long, point.lat],
                     show: mapStore.selectedPoint?.id === point.id,
                     onMouseEnter: () => mapStore.selectedPoint = point,
                     zIndex: mapStore.selectedPoint?.id === point.id ? 1 : 0,
                     onMouseLeave: () => mapStore.selectedPoint = null }"
      >
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
      </YandexMapPopupMarker>
    </template>
  </YandexMap>
</template>
