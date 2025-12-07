<script lang="ts" setup>
const locationStore = useLocationStore();
const { locations, locationsStatus: status } = storeToRefs(locationStore);

onMounted(() => {
  locationStore.locationsRefresh();
});

onBeforeRouteLeave((to) => {
  if (to.name !== "dashboard-location-slug") {
    locationStore.locationsRefresh();
  }
});
</script>

<template>
  <div class="page-content-top">
    <h2 class="text-xl mb-4">
      Ваши сохраненные места
    </h2>
    <div v-if="status === 'pending'">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else-if="locations && locations.length > 0" class="location-list">
      <LocationCard
        v-for="location in locations"
        :key="location.id"
        :map-point="createMapPointFromLocation(location)"
      />
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
