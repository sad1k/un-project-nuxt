<script lang="ts" setup>
definePageMeta({ layout: false });

const mapbox = useMapbox();
const { activePoints } = useAiRouteSession();

const mapLoaded = ref(false);
const mapRoutePoints = computed(() => activePoints.value.map(point => ({
  id: point.id,
  day: point.day,
  name: point.name,
  type: "culture" as const,
  lat: point.coordinates.lat,
  lng: point.coordinates.long,
  icon: "route",
})));

function onMapLoaded() {
  mapLoaded.value = true;
}

watch(mapRoutePoints, async (pts) => {
  if (!pts.length)
    return;
  await mapbox.addMarkers(pts);
  mapbox.drawRouteLine(pts);
  await mapbox.fitToRoute(pts);
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
    >
      <Icon
        class="animate-spin text-white"
        name="tabler:world"
        size="64"
      />
      <p class="mt-4 text-lg text-white/70">
        Loading map...
      </p>
    </div>

    <ExploreMapView @loaded="onMapLoaded" />

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/30 to-transparent" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/20 to-transparent" />

    <ExploreHeaderOverlay />
    <ExploreRoutePanel />
    <ExploreQuickActions />
  </div>
</template>
