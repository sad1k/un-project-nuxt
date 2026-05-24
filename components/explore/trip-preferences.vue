<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";

const { selectedDays, selectedInterests, toggleInterest } = useExploreContext();

const dayOptions = [1, 2, 3, 5, 7, 10, 14];
const interests: Array<{ icon: string; label: string; value: ExploreInterest }> = [
  { icon: "tabler:building-arch", label: "Культура", value: "culture" },
  { icon: "tabler:tools-kitchen-2", label: "Еда", value: "food" },
  { icon: "tabler:leaf", label: "Природа", value: "nature" },
  { icon: "tabler:mountain", label: "Приключения", value: "adventure" },
  { icon: "tabler:palette", label: "Искусство", value: "art" },
  { icon: "tabler:moon-stars", label: "Ночная жизнь", value: "nightlife" },
  { icon: "tabler:shopping-bag", label: "Шопинг", value: "shopping" },
  { icon: "tabler:sparkles", label: "Скрытые места", value: "hidden-gems" },
];
</script>

<template>
  <section class="space-y-4">
    <div>
      <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--explore-text-soft)]">
        Дни
      </label>
      <div class="grid grid-cols-7 gap-1.5">
        <button
          v-for="day in dayOptions"
          :key="day"
          class="rounded-lg px-2 py-2 text-sm font-semibold transition"
          :class="selectedDays === day
            ? 'bg-[var(--explore-text-strong)] text-[var(--explore-primary-text)] shadow-sm'
            : 'bg-[var(--explore-surface-soft)] text-[var(--explore-text-muted)] hover:bg-[var(--explore-surface-hover)]'"
          type="button"
          @click="selectedDays = day"
        >
          {{ day }}
        </button>
      </div>
    </div>

    <div>
      <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--explore-text-soft)]">
        Интересы
      </label>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="interest in interests"
          :key="interest.value"
          class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
          :class="selectedInterests.includes(interest.value)
            ? 'border-[var(--explore-warning-border)] bg-[var(--explore-warning-bg)] text-[var(--explore-text-strong)]'
            : 'border-[var(--explore-border)] bg-[var(--explore-surface-strong)] text-[var(--explore-text-muted)] hover:border-[var(--explore-border-strong)]'"
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
