<script lang="ts" setup>
import 'mapbox-gl/dist/mapbox-gl.css'

const emit = defineEmits<{
  loaded: []
}>()

const mapContainer = ref<HTMLElement | null>(null)
const config = useRuntimeConfig()
const { initMap, mapLoaded, destroy } = useMapbox()

watch(mapLoaded, (loaded) => {
  if (loaded) emit('loaded')
})

onMounted(() => {
  if (mapContainer.value) {
    initMap(mapContainer.value, config.public.mapboxToken as string)
  }
})

onUnmounted(() => {
  destroy()
})
</script>

<template>
  <div ref="mapContainer" class="absolute inset-0" />
</template>
