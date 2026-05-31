<script lang="ts" setup>
import type { LngLat, YMap } from "@yandex/ymaps3-types";
import type { YMapLocationRequest } from "@yandex/ymaps3-types/imperative/YMap";
import type { MapEvent } from "@yandex/ymaps3-types/imperative/YMapFeature/types";

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

import { createYndxMapAdapter, YNDX_MAP_DEFAULT_LOCATION } from "~/lib/map/yndxmap-adapter";

const colorMode = useColorMode();
const mapStore = useMapStore();

const tooltipVisible = ref(true);

const mapRef = shallowRef<YMap | null>(null);
const LOCATION = ref<YMapLocationRequest>({ ...YNDX_MAP_DEFAULT_LOCATION });

const mapSettings = computed(() => ({
  location: { ...LOCATION.value },
  theme: colorMode.value as "dark" | "light",
}));

onMounted(async () => {
  await mapStore.init(async () => createYndxMapAdapter(mapRef, LOCATION));
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
