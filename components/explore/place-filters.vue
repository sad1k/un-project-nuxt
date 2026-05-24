<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";

const { filters } = useExploreContext();

const categories: Array<{ label: string; value: ExploreInterest }> = [
  { label: "Культура", value: "culture" },
  { label: "Еда", value: "food" },
  { label: "Природа", value: "nature" },
  { label: "Искусство", value: "art" },
  { label: "Ночная жизнь", value: "nightlife" },
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
    <label class="block text-xs font-semibold uppercase tracking-wide text-[var(--explore-text-soft)]">
      Фильтры мест
    </label>
    <div class="relative">
      <Icon
        class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--explore-text-faint)]"
        name="tabler:filter-search"
        size="18"
      />
      <input
        v-model="filters.query"
        class="w-full rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-10 py-2.5 text-sm outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30"
        placeholder="Фильтр мест"
        type="search"
      >
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="category in categories"
        :key="category.value"
        class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
        :class="filters.interests.includes(category.value)
          ? 'bg-[var(--explore-text-strong)] text-[var(--explore-primary-text)]'
          : 'bg-[var(--explore-surface-soft)] text-[var(--explore-text-muted)] hover:bg-[var(--explore-surface-hover)]'"
        type="button"
        @click="toggleFilterInterest(category.value)"
      >
        {{ category.label }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="flex items-center gap-2 rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-xs font-medium text-[var(--explore-text-muted)]">
        <input
          v-model="filters.includeSavedPlaces"
          class="accent-[var(--explore-accent)]"
          type="checkbox"
        >
        Сохранённые
      </label>
      <label class="flex items-center gap-2 rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-strong)] px-3 py-2 text-xs font-medium text-[var(--explore-text-muted)]">
        <input
          v-model="filters.includeCandidatePlaces"
          class="accent-[var(--explore-accent)]"
          type="checkbox"
        >
        Предложенные
      </label>
    </div>
  </section>
</template>
