<script lang="ts" setup>
const { requestContext, selectedCity } = useExploreContext();
const aiRouteSession = useAiRouteSession();

const collapsed = ref(false);
const readyToGenerate = computed(() => Boolean(selectedCity.value));
const showRouteSession = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));
const routeStats = computed(() => ({
  estimatedHours: Math.ceil(aiRouteSession.activePoints.value.reduce(
    (total, point) => total + (point.estimatedDurationMinutes || 90),
    0,
  ) / 60),
  placeCount: aiRouteSession.activePoints.value.length,
  dayCount: new Set(aiRouteSession.activePoints.value.map(point => point.day)).size,
}));

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
            v-if="aiRouteSession.activePoints.value.length"
            class="space-y-2"
          >
            <h3 class="text-sm font-semibold text-gray-900">
              Route points
            </h3>
            <ol class="space-y-2">
              <li
                v-for="point in aiRouteSession.activePoints.value"
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
          @click="generateRoute"
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
