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
      <h3 class="text-sm font-semibold text-gray-900">
        Route days
      </h3>
      <span class="text-xs text-gray-500">{{ totalPointCount }} stops</span>
    </div>

    <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition"
        :class="modelValue === null ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        type="button"
        @click="emit('update:modelValue', null)"
      >
        All
      </button>
      <button
        v-for="group in dayGroups"
        :key="group.day"
        class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition"
        :class="modelValue === group.day ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
        type="button"
        @click="emit('update:modelValue', group.day)"
      >
        Day {{ group.day }}
      </button>
    </div>
  </section>
</template>
