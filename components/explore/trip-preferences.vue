<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";

const { selectedDays, selectedInterests, toggleInterest } = useExploreContext();

const dayOptions = [1, 2, 3, 5, 7, 10, 14];
const interests: Array<{ icon: string; label: string; value: ExploreInterest }> = [
  { icon: "tabler:building-arch", label: "Culture", value: "culture" },
  { icon: "tabler:tools-kitchen-2", label: "Food", value: "food" },
  { icon: "tabler:leaf", label: "Nature", value: "nature" },
  { icon: "tabler:mountain", label: "Adventure", value: "adventure" },
  { icon: "tabler:palette", label: "Art", value: "art" },
  { icon: "tabler:moon-stars", label: "Nightlife", value: "nightlife" },
  { icon: "tabler:shopping-bag", label: "Shopping", value: "shopping" },
  { icon: "tabler:sparkles", label: "Hidden gems", value: "hidden-gems" },
];
</script>

<template>
  <section class="space-y-4">
    <div>
      <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Days
      </label>
      <div class="grid grid-cols-7 gap-1.5">
        <button
          v-for="day in dayOptions"
          :key="day"
          class="rounded-lg px-2 py-2 text-sm font-semibold transition"
          :class="selectedDays === day
            ? 'bg-gray-900 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          type="button"
          @click="selectedDays = day"
        >
          {{ day }}
        </button>
      </div>
    </div>

    <div>
      <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Interests
      </label>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="interest in interests"
          :key="interest.value"
          class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
          :class="selectedInterests.includes(interest.value)
            ? 'border-amber-300 bg-amber-50 text-gray-900'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'"
          type="button"
          @click="toggleInterest(interest.value)"
        >
          <Icon
            :name="interest.icon"
            size="17"
          />
          <span>{{ interest.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
