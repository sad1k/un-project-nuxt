<script lang="ts" setup>
import type { ExploreCitySuggestion, SelectedExploreCity } from "~/lib/explore/search";

const { selectedCity, setSelectedCity } = useExploreContext();

const query = ref(selectedCity.value?.label || "");
const suggestions = ref<ExploreCitySuggestion[]>([]);
const loading = ref(false);
const error = ref("");
const activeIndex = ref(-1);
const open = computed(() => Boolean(query.value.trim()) && (suggestions.value.length > 0 || loading.value || Boolean(error.value)));

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const sessionToken = createSessionToken();

watch(query, (nextQuery) => {
  if (nextQuery === selectedCity.value?.label)
    return;

  if (debounceTimer)
    clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    void loadSuggestions(nextQuery);
  }, 250);
});

onBeforeUnmount(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer);
});

async function loadSuggestions(nextQuery: string) {
  const normalized = nextQuery.trim();
  suggestions.value = [];
  activeIndex.value = -1;
  error.value = "";

  if (normalized.length < 2)
    return;

  loading.value = true;
  try {
    suggestions.value = await $fetch<ExploreCitySuggestion[]>("/api/explore/city-suggest", {
      query: {
        q: normalized,
        sessionToken,
      },
    });
  }
  catch {
    error.value = "Поиск города сейчас недоступен";
  }
  finally {
    loading.value = false;
  }
}

async function selectSuggestion(suggestion: ExploreCitySuggestion) {
  error.value = "";
  loading.value = true;
  try {
    const city = await retrieveCity(suggestion);
    if (!city)
      throw new Error("Missing city coordinates");

    setSelectedCity(city);
    query.value = city.label;
    suggestions.value = [];
  }
  catch {
    error.value = "Не удалось выбрать этот город";
  }
  finally {
    loading.value = false;
  }
}

function selectActiveSuggestion() {
  const suggestion = suggestions.value[activeIndex.value] || suggestions.value[0];
  if (suggestion)
    void selectSuggestion(suggestion);
}

function moveActiveSuggestion(direction: number) {
  if (!suggestions.value.length)
    return;

  activeIndex.value = (activeIndex.value + direction + suggestions.value.length) % suggestions.value.length;
}

async function retrieveCity(suggestion: ExploreCitySuggestion) {
  if (suggestion.provider === "mapbox") {
    return await $fetch<SelectedExploreCity>("/api/explore/city-retrieve", {
      query: {
        provider: suggestion.provider,
        providerId: suggestion.providerId,
        sessionToken,
      },
    });
  }

  return await $fetch<SelectedExploreCity>("/api/explore/city-retrieve", {
    query: {
      provider: suggestion.provider,
      providerId: suggestion.providerId,
      label: suggestion.label,
      name: suggestion.name,
      lat: suggestion.coordinates?.lat,
      long: suggestion.coordinates?.long,
    },
  });
}

function createSessionToken() {
  if (import.meta.client && "crypto" in window && "randomUUID" in window.crypto)
    return window.crypto.randomUUID();

  return Math.random().toString(36).slice(2);
}
</script>

<template>
  <div class="relative">
    <label
      class="explore-section-label mb-2 block text-[10px] font-bold uppercase tracking-[0.28em]"
      for="explore-city-search"
    >
      Город
    </label>
    <div class="relative">
      <Icon
        class="explore-text-faint absolute left-3 top-1/2 -translate-y-1/2"
        name="tabler:map-pin-search"
        size="18"
      />
      <input
        id="explore-city-search"
        v-model="query"
        aria-autocomplete="list"
        :aria-expanded="open"
        autocomplete="off"
        class="explore-input w-full rounded-xl border px-10 py-3 text-sm transition focus:border-brand-gold/50 focus:ring-2 focus:ring-brand-gold/15"
        placeholder="Лиссабон, Порту, Токио..."
        type="search"
        @keydown.down.prevent="moveActiveSuggestion(1)"
        @keydown.enter.prevent="selectActiveSuggestion"
        @keydown.up.prevent="moveActiveSuggestion(-1)"
      >
      <Icon
        v-if="loading"
        class="explore-text-faint absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
        name="tabler:loader-2"
        size="18"
      />
    </div>

    <div
      v-if="open"
      class="explore-popover absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border"
      role="listbox"
    >
      <button
        v-for="(suggestion, index) in suggestions"
        :key="suggestion.id"
        class="flex w-full flex-col px-3 py-2 text-left transition hover:bg-[var(--explore-surface-hover)]"
        :class="index === activeIndex ? 'explore-active-surface' : ''"
        type="button"
        @click="selectSuggestion(suggestion)"
      >
        <span class="explore-text text-sm font-semibold">{{ suggestion.name }}</span>
        <span class="explore-text-soft truncate text-xs">{{ suggestion.description || suggestion.label }}</span>
      </button>

      <div
        v-if="!loading && !suggestions.length && !error"
        class="explore-text-soft px-3 py-2 text-sm"
      >
        Пока нет подходящих городов
      </div>
      <div
        v-if="error"
        class="px-3 py-2 text-sm text-[var(--explore-danger-text)]"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>
