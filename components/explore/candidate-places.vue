<script lang="ts" setup>
import type { ExploreCandidatePlace } from "~/lib/explore/context";

const {
  candidatePlaces,
  filters,
  selectedCity,
  selectedInterests,
  setCandidatePlaces,
  toggleCandidatePlace,
} = useExploreContext();

const loading = ref(false);
const error = ref("");

const visiblePlaces = computed(() => {
  const query = filters.value.query.trim().toLowerCase();
  const allowedInterests = new Set(filters.value.interests);

  return candidatePlaces.value.filter((place) => {
    const matchesQuery = !query || place.name.toLowerCase().includes(query);
    const matchesInterest = allowedInterests.size === 0 || place.categories.some(category => allowedInterests.has(category));
    return matchesQuery && matchesInterest;
  });
});

watch(
  () => [selectedCity.value?.id, selectedInterests.value.join(",")],
  () => {
    void loadCandidatePlaces();
  },
  { immediate: true },
);

async function loadCandidatePlaces() {
  if (!selectedCity.value) {
    setCandidatePlaces([]);
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const places = await $fetch<ExploreCandidatePlace[]>("/api/explore/candidate-places", {
      query: {
        cityName: selectedCity.value.name,
        interests: selectedInterests.value.join(","),
        lat: selectedCity.value.coordinates.lat,
        long: selectedCity.value.coordinates.long,
      },
    });
    setCandidatePlaces(places);
  }
  catch {
    error.value = "Popular places are unavailable";
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <label class="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Popular places
      </label>
      <span
        v-if="visiblePlaces.length"
        class="text-xs font-medium text-gray-400"
      >
        {{ visiblePlaces.filter(place => place.selected).length }} selected
      </span>
    </div>

    <div
      v-if="!selectedCity"
      class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500"
    >
      Select a destination to load starter places.
    </div>
    <div
      v-else-if="loading"
      class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500"
    >
      Loading popular places...
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600"
    >
      {{ error }}
    </div>
    <div
      v-else
      class="space-y-2"
    >
      <button
        v-for="place in visiblePlaces.slice(0, 8)"
        :key="place.id"
        class="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition"
        :class="place.selected
          ? 'border-amber-300 bg-amber-50'
          : 'border-gray-200 bg-white hover:border-gray-300'"
        type="button"
        @click="toggleCandidatePlace(place.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-gray-900">{{ place.name }}</span>
          <span class="block truncate text-xs text-gray-500">{{ place.description || place.categories.join(", ") }}</span>
        </span>
        <Icon
          :name="place.selected ? 'tabler:check' : 'tabler:plus'"
          class="mt-0.5 text-gray-500"
          size="17"
        />
      </button>
    </div>
  </section>
</template>
