<script lang="ts" setup>
import type { RouteWeatherTips } from "~/lib/explore/weather-tips";

defineProps<{
  tips: RouteWeatherTips | null;
  status: "idle" | "loading" | "loaded" | "unavailable" | "error";
  error?: string | null;
}>();
</script>

<template>
  <section class="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">
          Weather tips
        </h3>
        <p class="text-xs text-gray-500">
          What to take for this route
        </p>
      </div>
      <Icon
        class="text-sky-600"
        name="tabler:cloud-sun"
        size="18"
      />
    </div>

    <div
      v-if="status === 'loading'"
      class="mt-3 flex items-center gap-2 text-xs text-sky-700"
    >
      <Icon
        class="animate-spin"
        name="tabler:loader-2"
        size="14"
      />
      Loading weather guidance...
    </div>

    <div
      v-else-if="!tips || status === 'idle'"
      class="mt-3 text-xs text-gray-500"
    >
      Generate a route to see weather-aware guidance.
    </div>

    <div
      v-else
      class="mt-3 space-y-2"
    >
      <p
        v-if="tips.status === 'unavailable'"
        class="rounded-md bg-white/80 px-2 py-2 text-xs text-gray-600"
      >
        Weather unavailable. Check a local forecast before you go.
      </p>

      <article
        v-for="tip in tips.tips"
        :key="tip.id"
        class="rounded-md bg-white/90 px-2 py-2"
      >
        <div class="flex items-start gap-2">
          <Icon
            :class="tip.severity === 'high' ? 'text-red-500' : tip.severity === 'caution' ? 'text-amber-500' : 'text-sky-600'"
            :name="tip.severity === 'high' ? 'tabler:alert-triangle' : tip.severity === 'caution' ? 'tabler:alert-circle' : 'tabler:info-circle'"
            size="15"
          />
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-gray-900">
              {{ tip.title }}
            </div>
            <p class="mt-1 text-xs leading-5 text-gray-600">
              {{ tip.body }}
            </p>
            <div
              v-if="tip.whatToTake.length"
              class="mt-2 flex flex-wrap gap-1"
            >
              <span
                v-for="item in tip.whatToTake"
                :key="item"
                class="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800"
              >
                {{ item }}
              </span>
            </div>
            <div class="mt-1 text-[10px] text-gray-400">
              {{ tip.source.label }} · {{ tip.source.confidence }} confidence
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
