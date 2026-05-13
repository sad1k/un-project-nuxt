<script lang="ts" setup>
const emit = defineEmits<{
  loaded: [];
}>();

const mapContainer = ref<HTMLElement | null>(null);
const config = useRuntimeConfig();
const { initMap, mapLoaded, destroy } = useMapbox();

watch(mapLoaded, (loaded) => {
  if (loaded)
    emit("loaded");
});

onMounted(async () => {
  await nextTick();
  if (!mapContainer.value)
    return;

  await initMap(mapContainer.value, config.public.mapboxToken as string);
});

onUnmounted(() => {
  destroy();
});
</script>

<template>
  <div class="absolute inset-0">
    <div
      ref="mapContainer"
      class="h-full w-full"
    />
  </div>
</template>
