<script lang="ts" setup>
import { CURRENT_LOCATION_LOG_PAGES, EDIT_PAGES, LOCATION_PAGES } from "~/lib/constants";

const route = useRoute();
const locationStore = useLocationStore();

if (LOCATION_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.locationsRefresh();
}

if (EDIT_PAGES.includes(route.name?.toString() || "") || CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.currentLocationRefresh();
}

if (CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.currentLocationLogRefresh();
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-4rem)] flex-1 bg-gray-50 text-gray-950 transition-colors duration-300 dark:bg-[#050505] dark:text-white">
    <div class="min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(243,209,158,0.18),transparent_34%),#f9fafb] transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,rgba(243,209,158,0.08),transparent_34%),#050505]">
      <div class="flex size-full" :class="{ 'flex-col': !EDIT_PAGES.includes(route.name?.toString() || '') }">
        <NuxtPage />
        <AppYndxMap
          :key="EDIT_PAGES.includes(route.name?.toString() || '') ? 'edit' : 'view'"
          class="hidden md:flex flex-1 overflow-hidden"
        />
      </div>
    </div>
  </div>
</template>
