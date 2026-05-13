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
      <h3 class="text-sm font-semibold text-gray-900">
        Distance
      </h3>
      <span
        v-if="hasDistance"
        class="text-xs font-semibold text-gray-600"
      >
        {{ summary.knownDistanceLabel }}
      </span>
      <span
        v-else
        class="text-xs text-gray-400"
      >
        Estimate unavailable
      </span>
    </div>

    <div
      v-if="summary.missingLegCount"
      class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500"
    >
      {{ summary.missingLegCount }} leg{{ summary.missingLegCount === 1 ? "" : "s" }} missing distance estimates.
    </div>

    <ol class="space-y-1.5">
      <li
        v-for="leg in legs"
        :key="leg.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs"
      >
        <span class="min-w-0 truncate text-gray-600">
          {{ leg.from.name }} to {{ leg.to.name }}
        </span>
        <span
          class="shrink-0 font-semibold"
          :class="leg.distanceLabel ? 'text-gray-900' : 'text-gray-400'"
        >
          {{ leg.distanceLabel || "TBD" }}
        </span>
      </li>
    </ol>
  </section>
</template>
