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
  <div class="page-content-top px-8 py-6">
    <h2 class="text-3xl mb-8 font-display tracking-wide text-white">
      ТВОИ СОХРАНЕННЫЕ МЕСТА
    </h2>
    <div v-if="status === 'pending'">
      <span class="loading loading-spinner loading-xl text-brand-gold" />
    </div>
    <div v-else-if="locations && locations.length > 0" class="location-list flex flex-wrap gap-6">
      <LocationCard
        v-for="location in locations"
        :key="location.id"
        :map-point="createMapPointFromLocation(location)"
      />
    </div>
    <div v-else class="flex flex-col gap-4 items-start">
      <p class="text-gray-400 font-light">
        Add a place to start saving your memories.
      </p>
      <NuxtLink class="btn bg-brand-gold text-brand-dark border-none hover:bg-white min-w-[160px] font-bold" to="/dashboard/add">
        <Icon name="tabler:circle-plus-filled" size="24" />
        Add Place
      </NuxtLink>
    </div>
  </div>
</template>
