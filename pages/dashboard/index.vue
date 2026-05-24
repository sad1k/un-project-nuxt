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
  <div class="page-content-top px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div>
        <p class="mb-2 font-mono text-xs uppercase tracking-[0.28em] text-brand-gold/70">
          WanderLog
        </p>
        <h2 class="text-2xl font-display tracking-tight text-gray-950 sm:text-3xl dark:text-white">
          Твои сохранённые места
        </h2>
      </div>
      <NuxtLink
        class="btn w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20 transition active:scale-[0.98] hover:bg-teal-500 sm:w-auto"
        to="/dashboard/place-photo/new"
      >
        <Icon name="tabler:camera-plus" size="20" />
        Быстрое фото
      </NuxtLink>
    </div>

    <div
      v-if="status === 'pending'"
      class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Загрузка мест"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 motion-safe:animate-pulse md:flex-col md:gap-0 md:p-0 dark:border-white/10 dark:bg-white/5"
      >
        <div class="h-[72px] w-[72px] shrink-0 rounded-xl bg-gray-200/70 md:h-32 md:w-full md:rounded-b-none md:rounded-t-2xl dark:bg-white/10" />
        <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 md:p-3">
          <div class="h-4 w-2/3 rounded bg-gray-200/70 dark:bg-white/10" />
          <div class="h-3 w-4/5 rounded bg-gray-200/50 dark:bg-white/[0.06]" />
        </div>
      </div>
    </div>
    <div
      v-else-if="locations && locations.length > 0"
      class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
    >
      <LocationCard
        v-for="location in locations"
        :key="location.id"
        :map-point="createMapPointFromLocation(location)"
      />
    </div>
    <div
      v-else
      class="flex flex-col items-stretch gap-4 sm:items-start"
    >
      <p class="font-light text-gray-600 dark:text-gray-400">
        Добавьте место, чтобы начать сохранять воспоминания.
      </p>
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <NuxtLink
          class="btn w-full border-none bg-brand-gold font-bold text-brand-dark hover:bg-white sm:w-auto sm:min-w-[160px]"
          to="/dashboard/place-photo/new"
        >
          <Icon name="tabler:camera-plus" size="24" />
          Быстрое фото
        </NuxtLink>
        <NuxtLink
          class="btn btn-outline w-full border-brand-emerald text-brand-emerald hover:border-brand-emerald hover:bg-brand-emerald hover:text-white sm:w-auto"
          to="/explore"
        >
          <Icon name="tabler:compass" size="20" />
          Исследовать карту
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
