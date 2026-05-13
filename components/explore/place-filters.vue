<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";

const { filters } = useExploreContext();

const categories: Array<{ label: string; value: ExploreInterest }> = [
  { label: "Culture", value: "culture" },
  { label: "Food", value: "food" },
  { label: "Nature", value: "nature" },
  { label: "Art", value: "art" },
  { label: "Nightlife", value: "nightlife" },
];

function toggleFilterInterest(interest: ExploreInterest) {
  filters.value = {
    ...filters.value,
    interests: filters.value.interests.includes(interest)
      ? filters.value.interests.filter(value => value !== interest)
      : [...filters.value.interests, interest],
  };
}
</script>

<template>
  <section class="space-y-3">
    <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500">
      Place filters
    </label>
    <div class="relative">
      <Icon
        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        name="tabler:filter-search"
        size="18"
      />
      <input
        v-model="filters.query"
        class="w-full rounded-lg border border-gray-200 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
        placeholder="Filter places"
        type="search"
      >
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="category in categories"
        :key="category.value"
        class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
        :class="filters.interests.includes(category.value)
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        type="button"
        @click="toggleFilterInterest(category.value)"
      >
        {{ category.label }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
        <input
          v-model="filters.includeSavedPlaces"
          class="accent-amber-500"
          type="checkbox"
        >
        Saved
      </label>
      <label class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600">
        <input
          v-model="filters.includeCandidatePlaces"
          class="accent-amber-500"
          type="checkbox"
        >
        Suggested
      </label>
    </div>
  </section>
</template>
