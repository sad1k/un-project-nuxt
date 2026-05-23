<script lang="ts" setup>
type ConfirmedPoint = {
  lat: number;
  long: number;
};

const props = defineProps<{
  placeName: string;
  accuracyLabel: string;
}>();

const emit = defineEmits<{
  (event: "manual", point: ConfirmedPoint): void;
  (event: "changed"): void;
}>();

const point = defineModel<ConfirmedPoint | null>("point", { required: true });

const mapStore = useMapStore();

watch(point, (value) => {
  if (!value) {
    mapStore.addedPoint = null;
    return;
  }

  if (!mapStore.addedPoint) {
    mapStore.addedPoint = {
      id: 10,
      name: props.placeName || "Место фото",
      description: "перетащите метку или дважды нажмите на карту для подтверждения",
      lat: value.lat,
      long: value.long,
    };
    return;
  }

  mapStore.addedPoint.lat = value.lat;
  mapStore.addedPoint.long = value.long;
  mapStore.addedPoint.name = props.placeName || "Место фото";
}, { deep: true, immediate: true });

watch(() => mapStore.addedPoint && [mapStore.addedPoint.lat, mapStore.addedPoint.long], () => {
  if (!mapStore.addedPoint)
    return;

  point.value = {
    lat: mapStore.addedPoint.lat,
    long: mapStore.addedPoint.long,
  };
  emit("manual", point.value);
  emit("changed");
}, { deep: true });

onBeforeUnmount(() => {
  mapStore.addedPoint = null;
});
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
    <div class="flex items-start gap-3">
      <Icon
        name="tabler:map-pin-filled"
        class="mt-0.5 shrink-0 text-brand-gold"
        size="22"
      />
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-950 dark:text-white">
          Подтвердите метку на карте
        </p>
        <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-white/65">
          Перетащите метку или дважды нажмите на карту, чтобы точно поставить её на достопримечательность перед сохранением.
        </p>
        <p v-if="point" class="mt-2 font-mono text-xs text-gray-500 dark:text-white/50">
          {{ point.lat.toFixed(5) }}, {{ point.long.toFixed(5) }} - {{ accuracyLabel }}
        </p>
      </div>
    </div>
  </div>
</template>
