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
    error.value = "Популярные места сейчас недоступны";
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <label class="text-xs font-semibold uppercase tracking-wide text-[var(--explore-text-soft)]">
        Популярные места
      </label>
      <span
        v-if="visiblePlaces.length"
        class="text-xs font-medium text-[var(--explore-text-faint)]"
      >
        {{ visiblePlaces.filter(place => place.selected).length }} выбрано
      </span>
    </div>

    <div
      v-if="!selectedCity"
      class="rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-sm text-[var(--explore-text-soft)]"
    >
      Выберите направление, чтобы загрузить стартовые места.
    </div>
    <div
      v-else-if="loading"
      class="rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-sm text-[var(--explore-text-soft)]"
    >
      Загружаем популярные места...
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-[var(--explore-danger-border)] bg-[var(--explore-danger-bg)] px-3 py-2 text-sm text-[var(--explore-danger-text)]"
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
          ? 'border-[var(--explore-warning-border)] bg-[var(--explore-warning-bg)]'
          : 'border-[var(--explore-border)] bg-[var(--explore-surface-strong)] hover:border-[var(--explore-border-strong)]'"
        type="button"
        @click="toggleCandidatePlace(place.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-[var(--explore-text-strong)]">{{ place.name }}</span>
          <span class="block truncate text-xs text-[var(--explore-text-soft)]">{{ place.description || place.categories.join(", ") }}</span>
        </span>
        <Icon
          :name="place.selected ? 'tabler:check' : 'tabler:plus'"
          class="mt-0.5 text-[var(--explore-text-soft)]"
          size="17"
        />
      </button>
    </div>
  </section>
</template>
