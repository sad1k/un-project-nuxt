<script lang="ts" setup>
import {
  buildRouteLegs,
  filterRoutePointsByDay,
  getRouteDayGroups,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const { requestContext, selectedCity } = useExploreContext();
const aiRouteSession = useAiRouteSession();
const routeWeatherTips = useRouteWeatherTips();

const collapsed = ref(false);
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const routeDayGroups = computed(() => getRouteDayGroups(routeMapPoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const selectedRouteLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));
const readyToGenerate = computed(() => Boolean(selectedCity.value));
const activeVariant = computed(() => aiRouteSession.variants.value.find(
  variant => variant.id === aiRouteSession.activeVariantId.value,
) ?? null);
const activeVariantDiarySave = computed(() => activeVariant.value?.diarySave ?? null);
const diarySaveLabel = computed(() => {
  if (!activeVariant.value || activeVariant.value.status !== "completed")
    return "Diary will save after generation";

  if (!activeVariantDiarySave.value)
    return "Saving to diary";

  if (activeVariantDiarySave.value.status === "saved")
    return `Saved to diary ${activeVariantDiarySave.value.savedCount}/${activeVariantDiarySave.value.expectedPointCount}`;

  if (activeVariantDiarySave.value.status === "failed")
    return "Diary save failed";

  if (activeVariantDiarySave.value.status === "partial")
    return `Diary partially saved ${activeVariantDiarySave.value.savedCount}/${activeVariantDiarySave.value.expectedPointCount}`;

  return "Saving to diary";
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

async function generateRoute() {
  if (!selectedCity.value)
    return;

  await aiRouteSession.generateRoute(requestContext.value);
}
</script>

<template>
  <aside
    class="absolute bottom-4 left-4 top-20 z-20 transition-all duration-300"
    :class="collapsed ? 'w-10' : 'w-[400px]'"
  >
    <button
      v-if="collapsed"
      aria-label="Open route panel"
      class="flex h-full w-full items-center justify-center rounded-lg border border-white/30 bg-white/75 shadow-xl backdrop-blur-md transition hover:bg-white"
      type="button"
      @click="collapsed = false"
    >
      <Icon
        class="text-gray-600"
        name="tabler:chevron-right"
        size="18"
      />
    </button>

    <div
      v-else
      class="flex h-full flex-col overflow-hidden rounded-xl border border-white/30 bg-white/90 shadow-2xl backdrop-blur-xl"
    >
      <header class="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 class="text-base font-bold text-gray-900">
            Route builder
          </h2>
          <p class="text-xs text-gray-500">
            {{ requestContext.city?.label || "Choose a city to start" }}
          </p>
        </div>
        <button
          aria-label="Collapse route panel"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          type="button"
          @click="collapsed = true"
        >
          <Icon
            name="tabler:chevron-left"
            size="18"
          />
        </button>
      </header>

      <div class="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <ExploreCityTypeahead />
        <ExploreTripPreferences />
        <ExplorePlaceFilters />
        <ExploreContextSelector />
        <ExploreCandidatePlaces />

        <div class="space-y-4">
          <ExploreRouteDaySelector
            v-if="showRouteSession"
            v-model="selectedDay"
            :day-groups="routeDayGroups"
          />

          <div
            v-if="showRouteSession"
            class="grid grid-cols-3 gap-2"
          >
            <div class="rounded-lg bg-gray-50 p-3 text-center">
              <Icon
                class="mx-auto mb-1 text-amber-500"
                name="tabler:clock"
                size="16"
              />
              <div class="text-sm font-semibold text-gray-800">
                {{ routeStats.estimatedHours }}h
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 text-center">
              <Icon
                class="mx-auto mb-1 text-amber-500"
                name="tabler:map-pin"
                size="16"
              />
              <div class="text-sm font-semibold text-gray-800">
                {{ routeStats.placeCount }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 p-3 text-center">
              <Icon
                class="mx-auto mb-1 text-amber-500"
                name="tabler:target"
                size="16"
              />
              <div class="text-sm font-semibold text-gray-800">
                {{ routeStats.dayCount }}d
              </div>
            </div>
          </div>

          <ExploreRouteDistanceSummary
            v-if="selectedRouteLegs.length"
            :legs="selectedRouteLegs"
          />

          <div
            v-if="showRouteSession"
            class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <Icon
              :class="{ 'animate-spin': activeVariant?.status === 'completed' && (!activeVariantDiarySave || activeVariantDiarySave.status === 'pending') }"
              :name="activeVariantDiarySave?.status === 'failed' ? 'tabler:alert-triangle' : activeVariantDiarySave?.status === 'saved' ? 'tabler:bookmarks' : 'tabler:loader-2'"
              size="16"
            />
            <span>{{ diarySaveLabel }}</span>
          </div>

          <ExploreRouteWeatherTips
            v-if="showRouteSession"
            :error="routeWeatherTips.error.value"
            :status="routeWeatherTips.status.value"
            :tips="routeWeatherTips.tips.value"
          />

          <div
            v-if="aiRouteSession.lastWarning.value"
            class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {{ aiRouteSession.lastWarning.value }}
          </div>

          <div
            v-if="aiRouteSession.error.value"
            class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ aiRouteSession.error.value }}
          </div>

          <div
            v-if="selectedRoutePoints.length"
            class="space-y-2"
          >
            <h3 class="text-sm font-semibold text-gray-900">
              Route points
            </h3>
            <ol class="space-y-2">
              <li
                v-for="point in selectedRoutePoints"
                :key="point.id"
                class="rounded-lg border border-gray-100 bg-white px-3 py-2"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold text-gray-900">{{ point.name }}</span>
                  <span class="shrink-0 text-xs text-gray-500">Day {{ point.day }}</span>
                </div>
                <p class="mt-1 line-clamp-2 text-xs text-gray-500">
                  {{ point.rationale }}
                </p>
              </li>
            </ol>
          </div>

          <ExploreRouteHistory v-if="showRouteSession" />
          <ExploreRouteFollowUp v-if="showRouteSession" />
        </div>
      </div>

      <footer class="border-t border-gray-100 p-5">
        <button
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="aiRouteSession.isGenerating.value || !readyToGenerate"
          type="button"
          @click.prevent.stop="generateRoute"
        >
          <Icon
            v-if="aiRouteSession.isGenerating.value"
            class="animate-spin"
            name="tabler:loader-2"
            size="18"
          />
          <Icon
            v-else
            name="tabler:sparkles"
            size="18"
          />
          <span>{{ aiRouteSession.activePoints.value.length ? "Regenerate route" : "Generate AI route" }}</span>
        </button>
      </footer>
    </div>
  </aside>
</template>
