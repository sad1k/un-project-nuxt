<script lang="ts" setup>
import type { RouteDayGroup } from "~/lib/explore/route-map";

const props = defineProps<{
  dayGroups: RouteDayGroup[];
  modelValue: number | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number | null];
}>();

const totalPointCount = computed(() => props.dayGroups.reduce((total, group) => total + group.pointCount, 0));
</script>

<template>
  <section
    v-if="dayGroups.length"
    class="space-y-2"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--explore-text-faint)]">
        Дни маршрута
      </h3>
      <span class="text-xs text-[var(--explore-text-soft)]">{{ totalPointCount }} точек</span>
    </div>

    <div class="flex gap-1 rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] p-1">
      <button
        class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition"
        :class="modelValue === null ? 'bg-brand-gold/15 text-brand-gold shadow-sm' : 'text-[var(--explore-text-soft)] hover:text-[var(--explore-text)]'"
        type="button"
        @click="emit('update:modelValue', null)"
      >
        Все
      </button>
      <button
        v-for="group in dayGroups"
        :key="group.day"
        class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition"
        :class="modelValue === group.day ? 'bg-brand-gold/15 text-brand-gold shadow-sm' : 'text-[var(--explore-text-soft)] hover:text-[var(--explore-text)]'"
        type="button"
        @click="emit('update:modelValue', group.day)"
      >
        День {{ group.day }}
      </button>
    </div>
  </section>
</template>
