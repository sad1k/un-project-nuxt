<script lang="ts" setup>
import type { RouteLeg } from "~/lib/explore/route-map";

import { summarizeRouteDistance } from "~/lib/explore/route-map";

const props = defineProps<{
  legs: RouteLeg[];
}>();

const summary = computed(() => summarizeRouteDistance(props.legs));
const hasDistance = computed(() => summary.value.knownLegCount > 0);
</script>

<template>
  <section
    v-if="legs.length"
    class="space-y-2"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--explore-text-faint)]">
        Дистанция
      </h3>
      <span
        v-if="hasDistance"
        class="text-xs font-semibold text-[var(--explore-text-muted)]"
      >
        {{ summary.knownDistanceLabel }}
      </span>
      <span
        v-else
        class="text-xs text-[var(--explore-text-faint)]"
      >
        Оценка недоступна
      </span>
    </div>

    <div
      v-if="summary.missingLegCount"
      class="rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] px-3 py-2 text-xs text-[var(--explore-text-soft)]"
    >
      Нет оценки расстояния для участков: {{ summary.missingLegCount }}.
    </div>

    <ol class="space-y-1.5">
      <li
        v-for="leg in legs"
        :key="leg.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] px-3 py-2 text-xs"
      >
        <span class="min-w-0 truncate text-[var(--explore-text-soft)]">
          {{ leg.from.name }} - {{ leg.to.name }}
        </span>
        <span
          class="shrink-0 font-semibold"
          :class="leg.distanceLabel ? 'text-[var(--explore-text)]' : 'text-[var(--explore-text-faint)]'"
        >
          {{ leg.distanceLabel || "Уточняется" }}
        </span>
      </li>
    </ol>
  </section>
</template>
