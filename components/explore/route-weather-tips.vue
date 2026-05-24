<script lang="ts" setup>
import type { RouteWeatherTips } from "~/lib/explore/weather-tips";

defineProps<{
  tips: RouteWeatherTips | null;
  status: "idle" | "loading" | "loaded" | "unavailable" | "error";
  error?: string | null;
}>();

function formatConfidence(confidence: string) {
  const labels: Record<string, string> = {
    high: "высокая",
    low: "низкая",
    medium: "средняя",
  };

  return labels[confidence] || confidence;
}
</script>

<template>
  <section class="rounded-lg border border-[var(--explore-info-border)] bg-[var(--explore-info-bg)] p-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold text-[var(--explore-text)]">
          Советы по погоде
        </h3>
        <p class="text-xs text-[var(--explore-text-soft)]">
          Что взять на этот маршрут
        </p>
      </div>
      <Icon
        class="text-[var(--explore-info-text)]"
        name="tabler:cloud-sun"
        size="18"
      />
    </div>

    <div
      v-if="status === 'loading'"
      class="mt-3 flex items-center gap-2 text-xs text-[var(--explore-info-text)]"
    >
      <Icon
        class="animate-spin"
        name="tabler:loader-2"
        size="14"
      />
      Загружаем погодные советы...
    </div>

    <div
      v-else-if="!tips || status === 'idle'"
      class="mt-3 text-xs text-[var(--explore-text-soft)]"
    >
      Сгенерируйте маршрут, чтобы увидеть советы с учётом погоды.
    </div>

    <div
      v-else
      class="mt-3 space-y-2"
    >
      <p
        v-if="tips.status === 'unavailable'"
        class="rounded-md bg-[var(--explore-surface-soft)] px-2 py-2 text-xs text-[var(--explore-text-soft)]"
      >
        Погода недоступна. Проверьте местный прогноз перед выходом.
      </p>

      <article
        v-for="tip in tips.tips"
        :key="tip.id"
        class="rounded-md bg-[var(--explore-surface-soft)] px-2 py-2"
      >
        <div class="flex items-start gap-2">
          <Icon
            :class="tip.severity === 'high' ? 'text-[var(--explore-danger-text)]' : tip.severity === 'caution' ? 'text-[var(--explore-warning-text)]' : 'text-[var(--explore-info-text)]'"
            :name="tip.severity === 'high' ? 'tabler:alert-triangle' : tip.severity === 'caution' ? 'tabler:alert-circle' : 'tabler:info-circle'"
            size="15"
          />
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-[var(--explore-text)]">
              {{ tip.title }}
            </div>
            <p class="mt-1 text-xs leading-5 text-[var(--explore-text-soft)]">
              {{ tip.body }}
            </p>
            <div
              v-if="tip.whatToTake.length"
              class="mt-2 flex flex-wrap gap-1"
            >
              <span
                v-for="item in tip.whatToTake"
                :key="item"
                class="rounded-full bg-[var(--explore-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--explore-info-text)]"
              >
                {{ item }}
              </span>
            </div>
            <div class="mt-1 text-[10px] text-[var(--explore-text-faint)]">
              {{ tip.source.label }} · уверенность: {{ formatConfidence(tip.source.confidence) }}
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
