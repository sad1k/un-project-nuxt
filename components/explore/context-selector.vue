<script lang="ts" setup>
import type { ExplorePersonalContext } from "~/lib/explore/context";

const {
  currentLocation,
  selectedDiaryLogIds,
  selectedSavedPlaceIds,
  setCurrentLocation,
  toggleDiaryLog,
  toggleSavedPlace,
} = useExploreContext();
const locationState = useCurrentLocation();

const personalContext = ref<ExplorePersonalContext>({
  diaryLogs: [],
  savedPlaces: [],
});
const loading = ref(false);
const error = ref("");

onMounted(() => {
  void loadPersonalContext();
});

async function loadPersonalContext() {
  loading.value = true;
  error.value = "";
  try {
    personalContext.value = await $fetch<ExplorePersonalContext>("/api/explore/context");
  }
  catch {
    error.value = "Saved context is unavailable";
  }
  finally {
    loading.value = false;
  }
}

async function enableCurrentLocation() {
  const coordinates = await locationState.requestLocation();
  setCurrentLocation({
    enabled: Boolean(coordinates),
    coordinates: coordinates || undefined,
  });
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <label class="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Your context
      </label>
      <button
        class="flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
        type="button"
        @click="enableCurrentLocation"
      >
        <Icon
          :class="locationState.status.value === 'loading' ? 'animate-spin' : ''"
          name="tabler:current-location"
          size="15"
        />
        <span>{{ currentLocation.enabled ? "Nearby on" : "Use nearby" }}</span>
      </button>
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500"
    >
      Loading saved places...
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600"
    >
      {{ error }}
    </div>
    <div
      v-else-if="!personalContext.savedPlaces.length"
      class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500"
    >
      Saved places will appear here after you add them.
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <label
        v-for="place in personalContext.savedPlaces.slice(0, 4)"
        :key="place.id"
        class="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
      >
        <input
          class="mt-1 accent-amber-500"
          :checked="selectedSavedPlaceIds.includes(place.id)"
          type="checkbox"
          @change="toggleSavedPlace(place.id)"
        >
        <span class="min-w-0">
          <span class="block truncate font-semibold text-gray-900">{{ place.name }}</span>
          <span class="text-xs text-gray-500">{{ place.logCount }} diary logs</span>
        </span>
      </label>
    </div>

    <div
      v-if="personalContext.diaryLogs.length"
      class="space-y-2"
    >
      <label
        v-for="log in personalContext.diaryLogs.slice(0, 3)"
        :key="log.id"
        class="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
      >
        <input
          class="mt-0.5 accent-amber-500"
          :checked="selectedDiaryLogIds.includes(log.id)"
          type="checkbox"
          @change="toggleDiaryLog(log.id)"
        >
        <span class="min-w-0 truncate">{{ log.name }}</span>
      </label>
    </div>
  </section>
</template>
