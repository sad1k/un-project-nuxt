<script lang="ts" setup>
definePageMeta({ layout: false })

const mapbox = useMapbox()
const { points } = useRouteGenerator()

const mapLoaded = ref(false)

function onMapLoaded() {
  mapLoaded.value = true
}

watch(points, (pts) => {
  if (!pts.length) return
  mapbox.addMarkers(pts)
  mapbox.drawRouteLine(pts)
  mapbox.fitToRoute(pts)
})
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden">
    <!-- Loading screen -->
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-brand-dark"
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
    <ExploreNavSidebar />
    <ExploreHeaderOverlay />
    <ExploreRoutePanel />
  </div>
</template>
