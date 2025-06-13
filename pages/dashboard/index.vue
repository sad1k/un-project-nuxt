<script lang="ts" setup>
const locationStore = useLocationStore();
const mapStore = useMapStore();
const { locations, status } = storeToRefs(locationStore);

onMounted(() => {
  locationStore.refresh();
});
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl mb-4">
      Ваши сохраненные места
    </h2>
    <div v-if="status === 'pending'">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else-if="locations && locations.length > 0" class="flex flex-nowrap mt-2 gap-2 overflow-auto">
      <div
        v-for="location in locations"
        :key="location.id"
        class="card card-compact bg-base-200 h-40 w-47 shrink-0 cursor-pointer border-2 mb-2"
        :class="{ 'border-accent': location === mapStore.selectedPoint, 'border-transparent': location !== mapStore.selectedPoint }"
        @mouseenter="mapStore.selectedPoint = location"
        @mouseleave="mapStore.selectedPoint = null"
      >
        <div class="card-body">
          <h3 class="text-xl">
            {{ location.name }}
          </h3>
          <p>{{ location.description }}</p>
          <button
            v-if="mapStore.flyToPoint !== location"
            class="btn btn-primary"
            @click="mapStore.flyToPoint = location"
          >
            <span>Перейти к месту на карте</span>
          </button>
          <button
            v-else
            class="btn btn-accent"
            @click="mapStore.flyToPoint = null"
          >
            <span>Сбросить</span>
          </button>
        </div>
      </div>
    </div>
    <div v-else class="flex flex-col gap-2">
      <p>Добавить место чтобы начать сохранять</p>
      <NuxtLink class="btn btn-primary w-40" to="/dashboard/add">
        <Icon name="tabler:circle-plus-filled" size="24" />
        Добавить
      </NuxtLink>
    </div>
  </div>
</template>
