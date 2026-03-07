<script lang="ts" setup>
definePageMeta({ layout: false })

const mapbox = useMapbox()
const router = useRouteGenerator()

const mapLoaded = ref(false)

function onMapLoaded() {
  mapLoaded.value = true
}

watch(() => router.points.value, (points) => {
  if (!points.length) return
  mapbox.addMarkers(points)
  mapbox.drawRouteLine(points)
  mapbox.fitToRoute(points)
})
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden">
    <!-- Loading screen -->
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
    >
      <div class="text-6xl animate-spin">
        🌍
      </div>
      <p class="mt-4 text-white/70 text-lg">
        Loading map...
      </p>
    </div>

    <!-- Map -->
    <ExploreMapView @loaded="onMapLoaded" />

    <!-- Gradient overlays -->
    <div class="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-10" />
    <div class="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10" />

    <!-- UI Overlays -->
    <ExploreHeaderOverlay />
    <ExploreRoutePanel
      :destination="router.destination"
      :selected-days="router.selectedDays"
      :selected-interests="router.selectedInterests"
      :points="router.points"
      :generating="router.generating"
      :stats="router.stats"
      @generate="router.generate"
    />
    <ExploreQuickActions />
  </div>
</template>
