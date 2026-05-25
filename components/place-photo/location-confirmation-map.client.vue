<script lang="ts" setup>
import type { YMap } from "@yandex/ymaps3-types";
import type { YMapLocationRequest } from "@yandex/ymaps3-types/imperative/YMap";
import type { MapEvent } from "@yandex/ymaps3-types/imperative/YMapFeature/types";

import {
  YandexMap,
  YandexMapControls,
  YandexMapDefaultFeaturesLayer,
  YandexMapDefaultSchemeLayer,
  YandexMapListener,
  YandexMapUiMarker,
  YandexMapZoomControl,
} from "vue-yandex-maps";

import { YNDX_MAP_DEFAULT_LOCATION } from "~/lib/map/yndxmap-adapter";

type ConfirmedPoint = {
  lat: number;
  long: number;
};

const props = defineProps<{
  placeName?: string;
  accuracyLabel?: string;
}>();

const emit = defineEmits<{
  (event: "changed"): void;
}>();

const point = defineModel<ConfirmedPoint | null>("point", { required: true });

const colorMode = useColorMode();
const mapRef = shallowRef<YMap | null>(null);

const location = ref<YMapLocationRequest>(point.value
  ? { center: [point.value.long, point.value.lat], zoom: 14 }
  : { ...YNDX_MAP_DEFAULT_LOCATION, zoom: 3 });

const mapSettings = computed(() => ({
  location: { ...location.value },
  theme: colorMode.value as "dark" | "light",
}));

function applyPoint(lng: number, lat: number) {
  point.value = { lat, long: lng };
  emit("changed");
}

function onMarkerDragEnd(coords: [number, number]) {
  applyPoint(coords[0], coords[1]);
}

function onDoubleClick(_unused: unknown, mapEvent: MapEvent) {
  const [lng, lat] = mapEvent.coordinates;
  applyPoint(lng, lat);
}

watch(point, (next, prev) => {
  if (!next)
    return;
  if (prev && Math.abs(prev.lat - next.lat) < 1e-6 && Math.abs(prev.long - next.long) < 1e-6)
    return;

  location.value = {
    center: [next.long, next.lat],
    zoom: Math.max(location.value.zoom ?? 0, 14),
    duration: 1200,
    easing: "ease-out",
  };
});
</script>

<template>
  <div class="place-photo-map relative h-full w-full">
    <YandexMap
      v-model="mapRef"
      real-settings-location
      :settings="mapSettings"
    >
      <YandexMapDefaultSchemeLayer />
      <YandexMapDefaultFeaturesLayer />
      <YandexMapControls :settings="{ position: 'right' }">
        <YandexMapZoomControl />
      </YandexMapControls>

      <YandexMapListener :settings="{ onDblClick: onDoubleClick }" />

      <YandexMapUiMarker
        v-if="point"
        :settings="{
          coordinates: [point.long, point.lat],
          zIndex: 5,
          draggable: true,
          onDragEnd: onMarkerDragEnd,
        }"
      >
        <div class="place-photo-pin-wrap" :title="props.placeName || 'Перетащите метку, чтобы уточнить место'">
          <div class="place-photo-pin">
            <Icon name="tabler:map-pin-filled" size="22" />
          </div>
          <div class="place-photo-pin-stem" />
          <div class="place-photo-pin-pulse" />
        </div>
      </YandexMapUiMarker>
    </YandexMap>

    <p
      v-if="point && accuracyLabel"
      class="pointer-events-none absolute left-1/2 top-4 z-[1] -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 font-mono text-[11px] text-white/80 backdrop-blur-md"
    >
      {{ point.lat.toFixed(5) }}, {{ point.long.toFixed(5) }} · {{ accuracyLabel }}
    </p>
  </div>
</template>

<style scoped>
.place-photo-pin-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -100%);
  cursor: grab;
}

.place-photo-pin-wrap:active {
  cursor: grabbing;
}

.place-photo-pin {
  display: flex;
  height: 40px;
  width: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #050505;
  background: linear-gradient(135deg, #f3d19e 0%, #e2a64a 60%, #c98b2a 100%);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  ring: 2px solid rgba(5, 5, 5, 0.4);
  transition: transform 0.15s ease-out;
}

.place-photo-pin:hover {
  transform: scale(1.08);
}

.place-photo-pin-stem {
  width: 4px;
  height: 12px;
  background: rgba(243, 209, 158, 0.85);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
  margin-top: -2px;
  border-radius: 0 0 4px 4px;
}

.place-photo-pin-pulse {
  position: absolute;
  inset: -8px 0 0 0;
  top: 0;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background: rgba(243, 209, 158, 0.22);
  animation: place-photo-pin-pulse 2s ease-out infinite;
  z-index: -1;
}

@keyframes place-photo-pin-pulse {
  0% { transform: scale(0.6); opacity: 0.85; }
  100% { transform: scale(1.8); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .place-photo-pin-pulse { animation: none; }
}
</style>
