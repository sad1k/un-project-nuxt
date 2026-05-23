<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";

import {
  buildRouteLegs,
  filterRoutePointsByDay,
  getRouteDayGroups,
  summarizeRouteDistance,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const { requestContext, selectedCity, selectedDays, selectedInterests, toggleInterest } = useExploreContext();
const aiRouteSession = useAiRouteSession();
const routeWeatherTips = useRouteWeatherTips();

const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);
const transportMode = ref<"walk" | "bike" | "drive">("walk");
const isPanelCollapsed = ref(false);
const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const routeDayGroups = computed(() => getRouteDayGroups(routeMapPoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const selectedStoryPoint = computed(() => selectedRoutePoints.value.find(
  point => point.sourceId === selectedStoryRoutePointId.value,
) ?? selectedRoutePoints.value[0] ?? null);
const selectedRouteLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));
const readyToGenerate = computed(() => Boolean(selectedCity.value));
const activeVariant = computed(() => aiRouteSession.variants.value.find(
  variant => variant.id === aiRouteSession.activeVariantId.value,
) ?? null);
const activeVariantDiarySave = computed(() => activeVariant.value?.diarySave ?? null);
const diarySaveLabel = computed(() => {
  if (!activeVariant.value || activeVariant.value.status !== "completed")
    return "Сохраните точки маршрута с карты";

  if (!activeVariantDiarySave.value)
    return "Точки маршрута не сохранены";

  if (activeVariantDiarySave.value.status === "saved")
    return `Сохранено в дневник ${activeVariantDiarySave.value.savedCount}/${activeVariantDiarySave.value.expectedPointCount}`;

  if (activeVariantDiarySave.value.status === "failed")
    return "Не удалось сохранить в дневник";

  if (activeVariantDiarySave.value.status === "partial")
    return `Частично сохранено в дневник ${activeVariantDiarySave.value.savedCount}/${activeVariantDiarySave.value.expectedPointCount}`;

  return "Точки маршрута не сохранены";
});
const showRouteSession = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));
const routeStats = computed(() => ({
  estimatedHours: Math.ceil(selectedRoutePoints.value.reduce(
    (total, point) => total + (point.estimatedDurationMinutes || 90),
    0,
  ) / 60),
  placeCount: selectedRoutePoints.value.length,
  dayCount: routeDayGroups.value.length,
}));
const routeMinutes = computed(() => selectedRoutePoints.value.reduce(
  (total, point) => total + (point.estimatedDurationMinutes || 90),
  0,
));
const routeDistance = computed(() => summarizeRouteDistance(selectedRouteLegs.value));
const routeDistanceLabel = computed(() => routeDistance.value.knownDistanceLabel || "—");
const dayTicks = Array.from({ length: 14 }, (_, index) => index + 1);
const interests: Array<{ icon: string; label: string; value: ExploreInterest }> = [
  { icon: "tabler:tools-kitchen-2", label: "Еда", value: "food" },
  { icon: "tabler:camera", label: "Виды", value: "art" },
  { icon: "tabler:building-bank", label: "История", value: "culture" },
  { icon: "tabler:mountain", label: "Природа", value: "nature" },
  { icon: "tabler:sparkles", label: "Культура", value: "hidden-gems" },
  { icon: "tabler:music", label: "Музыка", value: "nightlife" },
];
const transportModes = [
  { icon: "tabler:walk", label: "Пешком", value: "walk" },
  { icon: "tabler:bike", label: "Вело", value: "bike" },
  { icon: "tabler:car", label: "Авто", value: "drive" },
] as const;

function updateDays(delta: number) {
  selectedDays.value = Math.min(14, Math.max(1, selectedDays.value + delta));
}

watch(
  [selectedRoutePoints, () => requestContext.value.selectedDays, selectedCity],
  ([points, selectedDays, city]) => {
    void routeWeatherTips.loadWeatherTips({
      points,
      selectedDays,
      cityLabel: city?.label,
    });
  },
  { immediate: true },
);

watch(selectedRoutePoints, (points) => {
  if (!points.length) {
    selectedStoryRoutePointId.value = null;
    return;
  }

  if (!points.some(point => point.sourceId === selectedStoryRoutePointId.value))
    selectedStoryRoutePointId.value = points[0]?.sourceId ?? null;
}, { immediate: true });

async function generateRoute() {
  if (!selectedCity.value)
    return;

  await aiRouteSession.generateRoute(requestContext.value);
}

function togglePanelCollapsed() {
  isPanelCollapsed.value = !isPanelCollapsed.value;
}
</script>

<template>
  <aside
    class="explore-panel absolute right-4 top-20 z-30 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 max-md:inset-x-3 max-md:bottom-24 max-md:top-auto"
    :class="isPanelCollapsed
      ? 'w-[320px] max-w-[calc(100vw-1.5rem)] max-md:w-auto'
      : 'bottom-4 w-[380px] max-h-[calc(100vh-6rem)] max-md:bottom-24 max-md:w-auto max-md:max-h-[52svh]'"
  >
    <header class="explore-panel-divider px-5 pb-4 pt-5" :class="{ 'border-b': !isPanelCollapsed }">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="explore-section-label text-[10px] font-bold uppercase tracking-[0.34em]">
            AI-планировщик маршрута
          </p>
          <h2 class="explore-text mt-3 text-[24px] font-semibold leading-tight tracking-tight">
            Соберём <span class="explore-accent-text">идеальный</span> день
          </h2>
        </div>
        <button
          :aria-label="isPanelCollapsed ? 'Развернуть панель маршрута' : 'Свернуть панель маршрута'"
          :aria-expanded="!isPanelCollapsed"
          class="explore-icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
          type="button"
          @click="togglePanelCollapsed"
        >
          <Icon :name="isPanelCollapsed ? 'tabler:chevron-up' : 'tabler:chevron-down'" size="14" />
        </button>
      </div>
    </header>

    <div v-show="!isPanelCollapsed" class="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
      <section>
        <ExploreCityTypeahead />
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <span class="explore-section-label text-[10px] font-bold uppercase tracking-[0.28em]">Длительность</span>
          <span class="explore-text-soft font-mono text-[11px]">дней</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            aria-label="Уменьшить длительность"
            class="explore-icon-button flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-35"
            :disabled="selectedDays <= 1"
            type="button"
            @click="updateDays(-1)"
          >
            <Icon name="tabler:minus" size="14" />
          </button>
          <div class="explore-card flex h-14 flex-1 flex-col items-center justify-center rounded-xl border">
            <span class="explore-accent-text font-display text-[24px] leading-none">{{ selectedDays }}</span>
            <span class="explore-section-label mt-1 font-mono text-[10px] uppercase tracking-wider">дней</span>
          </div>
          <button
            aria-label="Увеличить длительность"
            class="explore-icon-button flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-35"
            :disabled="selectedDays >= 14"
            type="button"
            @click="updateDays(1)"
          >
            <Icon name="tabler:plus" size="14" />
          </button>
        </div>
        <div class="mt-3 flex items-center justify-between px-1">
          <span
            v-for="tick in dayTicks"
            :key="tick"
            class="h-0.5 w-1 rounded-full transition"
            :class="tick <= selectedDays ? 'explore-accent-fill' : 'bg-[var(--explore-border-strong)]'"
          />
        </div>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <span class="explore-section-label text-[10px] font-bold uppercase tracking-[0.28em]">Интересы</span>
          <span class="explore-text-soft font-mono text-[11px]">{{ selectedInterests.length }} / 6</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="interest in interests"
            :key="interest.value"
            class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition"
            :class="selectedInterests.includes(interest.value)
              ? 'explore-chip-active'
              : 'explore-chip'"
            type="button"
            @click="toggleInterest(interest.value)"
          >
            <Icon :name="interest.icon" size="13" />
            {{ interest.label }}
          </button>
        </div>
      </section>

      <section>
        <span class="explore-section-label mb-3 block text-[10px] font-bold uppercase tracking-[0.28em]">Способ передвижения</span>
        <div class="explore-segment grid grid-cols-3 rounded-lg border p-1">
          <button
            v-for="mode in transportModes"
            :key="mode.value"
            class="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition"
            :class="transportMode === mode.value ? 'explore-segment-active shadow-sm' : 'explore-segment-button'"
            type="button"
            @click="transportMode = mode.value"
          >
            <Icon :name="mode.icon" size="13" />
            {{ mode.label }}
          </button>
        </div>
      </section>

      <section
        v-if="showRouteSession"
        class="space-y-4"
      >
        <ExploreRouteDaySelector
          v-model="selectedDay"
          :day-groups="routeDayGroups"
        />

        <div class="grid grid-cols-3 gap-2">
          <div class="explore-card rounded-lg border p-3 text-center">
            <Icon
              class="explore-accent-text mx-auto mb-1"
              name="tabler:clock"
              size="15"
            />
            <div class="explore-text text-sm font-semibold">
              {{ routeStats.estimatedHours }}h
            </div>
          </div>
          <div class="explore-card rounded-lg border p-3 text-center">
            <Icon
              class="explore-accent-text mx-auto mb-1"
              name="tabler:map-pin"
              size="15"
            />
            <div class="explore-text text-sm font-semibold">
              {{ routeStats.placeCount }}
            </div>
          </div>
          <div class="explore-card rounded-lg border p-3 text-center">
            <Icon
              class="explore-accent-text mx-auto mb-1"
              name="tabler:route"
              size="15"
            />
            <div class="explore-text text-sm font-semibold">
              {{ routeDistanceLabel }}
            </div>
          </div>
        </div>

        <div class="explore-status-success flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Icon
            :name="activeVariantDiarySave?.status === 'failed' ? 'tabler:alert-triangle' : activeVariantDiarySave?.status === 'saved' || activeVariantDiarySave?.status === 'partial' ? 'tabler:bookmarks' : 'tabler:bookmark-plus'"
            size="16"
          />
          <span>{{ diarySaveLabel }}</span>
        </div>

        <ExploreRouteWeatherTips
          :error="routeWeatherTips.error.value"
          :status="routeWeatherTips.status.value"
          :tips="routeWeatherTips.tips.value"
        />

        <ExplorePlaceStoryCard
          :point="selectedStoryPoint"
          :session-id="aiRouteSession.sessionId.value"
          :variant-id="aiRouteSession.activeVariantId.value"
        />

        <div
          v-if="aiRouteSession.lastWarning.value"
          class="explore-status-warning rounded-lg border px-3 py-2 text-sm"
        >
          {{ aiRouteSession.lastWarning.value }}
        </div>

        <div
          v-if="aiRouteSession.error.value"
          class="explore-status-danger rounded-lg border px-3 py-2 text-sm"
        >
          {{ aiRouteSession.error.value }}
        </div>

        <div
          v-if="selectedRoutePoints.length"
          class="space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="explore-section-label text-[10px] font-bold uppercase tracking-[0.28em]">Ваш маршрут</span>
            <span class="explore-text-soft font-mono text-[11px]">{{ routeMinutes }} мин · {{ routeDistanceLabel }}</span>
          </div>
          <div class="relative">
            <div class="absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-brand-emerald via-brand-emerald/40 to-brand-sangria" />
            <ol class="space-y-2">
              <li v-for="(point, index) in selectedRoutePoints" :key="point.id">
                <button
                  class="explore-route-item group relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition"
                  type="button"
                  @click="selectedStoryRoutePointId = point.sourceId"
                >
                  <div
                    class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px]"
                    :class="point.sourceId === selectedStoryRoutePointId ? 'bg-brand-emerald text-[var(--explore-primary-text)]' : index === selectedRoutePoints.length - 1 ? 'bg-brand-sangria text-[var(--explore-primary-text)]' : 'explore-route-stop-marker border'"
                  >
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="explore-text truncate text-[13px] font-semibold">
                      {{ point.name }}
                    </div>
                    <div class="explore-text-soft mt-0.5 flex items-center gap-2 text-[11px]">
                      <span>День {{ point.day }}</span>
                      <span class="h-0.5 w-0.5 rounded-full bg-[var(--explore-text-faint)]" />
                      <span class="flex items-center gap-1">
                        <Icon name="tabler:clock" size="10" />
                        {{ point.estimatedDurationMinutes || 90 }} мин
                      </span>
                    </div>
                  </div>
                  <Icon
                    class="explore-text-faint opacity-0 transition group-hover:opacity-100"
                    name="tabler:grip-vertical"
                    size="15"
                  />
                </button>
              </li>
            </ol>
          </div>
        </div>

        <ExploreRouteDistanceSummary
          v-if="selectedRouteLegs.length"
          :legs="selectedRouteLegs"
        />
        <ExploreRouteHistory />
        <ExploreRouteFollowUp />
      </section>
    </div>

    <footer v-show="!isPanelCollapsed" class="explore-panel-divider flex items-center gap-2 border-t px-5 py-4">
      <button
        class="explore-primary-button flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[12.5px] font-bold tracking-wide shadow-lg shadow-brand-emerald/25 transition disabled:cursor-not-allowed"
        :disabled="aiRouteSession.isGenerating.value || !readyToGenerate"
        type="button"
        @click.prevent.stop="generateRoute"
      >
        <Icon
          :class="{ 'animate-spin': aiRouteSession.isGenerating.value }"
          :name="aiRouteSession.isGenerating.value ? 'tabler:loader-2' : 'tabler:sparkles'"
          size="15"
        />
        <span class="truncate">{{ aiRouteSession.activePoints.value.length ? "Обновить маршрут" : "Сгенерировать маршрут" }}</span>
      </button>
      <button
        aria-label="Сохранить маршрут"
        class="explore-footer-button flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition"
        type="button"
      >
        <Icon name="tabler:bookmark" size="15" />
      </button>
      <button
        aria-label="Поделиться маршрутом"
        class="explore-footer-button flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition"
        type="button"
      >
        <Icon name="tabler:share-3" size="15" />
      </button>
    </footer>
  </aside>
</template>
