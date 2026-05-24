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
    error.value = "Сохранённый контекст сейчас недоступен";
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
      <label class="text-xs font-semibold uppercase tracking-wide text-[var(--explore-text-soft)]">
        Ваш контекст
      </label>
      <button
        class="flex items-center gap-1.5 rounded-lg bg-[var(--explore-surface-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--explore-text-muted)] transition hover:bg-[var(--explore-surface-hover)]"
        type="button"
        @click="enableCurrentLocation"
      >
        <Icon
          :class="locationState.status.value === 'loading' ? 'animate-spin' : ''"
          name="tabler:current-location"
          size="15"
        />
        <span>{{ currentLocation.enabled ? "Рядом включено" : "Искать рядом" }}</span>
      </button>
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-sm text-[var(--explore-text-soft)]"
    >
      Загружаем сохранённые места...
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-[var(--explore-danger-border)] bg-[var(--explore-danger-bg)] px-3 py-2 text-sm text-[var(--explore-danger-text)]"
    >
      {{ error }}
    </div>
    <div
      v-else-if="!personalContext.savedPlaces.length"
      class="rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-sm text-[var(--explore-text-soft)]"
    >
      Сохранённые места появятся здесь после добавления.
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <label
        v-for="place in personalContext.savedPlaces.slice(0, 4)"
        :key="place.id"
        class="flex items-start gap-2 rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-sm text-[var(--explore-text)]"
      >
        <input
          class="mt-1 accent-[var(--explore-accent)]"
          :checked="selectedSavedPlaceIds.includes(place.id)"
          type="checkbox"
          @change="toggleSavedPlace(place.id)"
        >
        <span class="min-w-0">
          <span class="block truncate font-semibold text-[var(--explore-text-strong)]">{{ place.name }}</span>
          <span class="text-xs text-[var(--explore-text-soft)]">{{ place.logCount }} записей дневника</span>
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
        class="flex items-start gap-2 rounded-lg bg-[var(--explore-surface-soft)] px-3 py-2 text-xs text-[var(--explore-text-muted)]"
      >
        <input
          class="mt-0.5 accent-[var(--explore-accent)]"
          :checked="selectedDiaryLogIds.includes(log.id)"
          type="checkbox"
          @change="toggleDiaryLog(log.id)"
        >
        <span class="min-w-0 truncate">{{ log.name }}</span>
      </label>
    </div>
  </section>
</template>
