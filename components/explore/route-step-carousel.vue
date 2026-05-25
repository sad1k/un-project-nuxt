<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

import {
  buildRouteLegs,
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const emit = defineEmits<{
  openDetails: [point: RouteMapPoint];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
}>();

const aiRouteSession = useAiRouteSession();
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);

const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const routeLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));

const showCarousel = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));

function legDistanceLabel(index: number): string {
  const leg = routeLegs.value[index];
  if (!leg?.distanceLabel)
    return "";
  return leg.distanceLabel;
}

function isLast(index: number): boolean {
  return index === selectedRoutePoints.value.length - 1;
}

function onSelectCard(point: RouteMapPoint) {
  selectedStoryRoutePointId.value = point.sourceId;
}
</script>

<template>
  <section
    v-if="showCarousel"
    class="route-step-carousel pointer-events-auto fixed inset-x-0 bottom-[80px] z-30 md:hidden"
    data-testid="explore-route-step-carousel"
  >
    <ol
      class="route-step-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[10vw] pb-3 pt-2"
      data-testid="explore-route-step-track"
    >
      <li
        v-for="(point, index) in selectedRoutePoints"
        :key="point.id"
        class="route-step-card-slot snap-center shrink-0 px-1.5"
        style="flex-basis: 84%;"
      >
        <button
          class="route-step-card explore-card group flex w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition"
          :class="point.sourceId === selectedStoryRoutePointId ? 'route-step-card-active' : ''"
          type="button"
          @click="onSelectCard(point); emit('openDetails', point)"
        >
          <div class="route-step-thumb flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <Icon
              class="explore-text-faint"
              name="tabler:photo"
              size="22"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]"
                :class="isLast(index)
                  ? 'bg-brand-sangria text-[var(--explore-primary-text)]'
                  : point.sourceId === selectedStoryRoutePointId
                    ? 'bg-brand-emerald text-[var(--explore-primary-text)]'
                    : 'explore-route-stop-marker border'"
              >
                {{ index + 1 }}
              </span>
              <span class="explore-text truncate text-sm font-semibold">{{ point.name }}</span>
            </div>
            <div class="explore-text-soft mt-1.5 flex items-center gap-2 text-[11px]">
              <span class="flex items-center gap-1">
                <Icon name="tabler:clock" size="11" />
                {{ point.estimatedDurationMinutes || 90 }} мин
              </span>
              <span v-if="legDistanceLabel(index)" class="flex items-center gap-1">
                <span class="h-0.5 w-0.5 rounded-full bg-[var(--explore-text-faint)]" />
                <Icon name="tabler:arrow-right" size="11" />
                {{ legDistanceLabel(index) }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <button
                aria-label="Сохранить место"
                class="route-step-action explore-chip flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition"
                type="button"
                @click.stop="emit('save', point)"
              >
                <Icon name="tabler:bookmark-plus" size="12" />
                <span>Сохранить</span>
              </button>
              <button
                aria-label="Маршрут к месту"
                class="route-step-action explore-chip flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition"
                type="button"
                @click.stop="emit('directions', point)"
              >
                <Icon name="tabler:navigation" size="12" />
                <span>К месту</span>
              </button>
            </div>
          </div>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.route-step-track::-webkit-scrollbar {
  display: none;
}
.route-step-track {
  scrollbar-width: none;
}
.route-step-card {
  background: var(--explore-surface-strong);
  border-color: var(--explore-border);
  box-shadow: 0 12px 28px var(--explore-shadow);
}
.route-step-card-active {
  border-color: color-mix(in srgb, var(--explore-accent-strong) 50%, transparent);
  box-shadow: 0 16px 36px var(--explore-overlay-shadow);
}
.route-step-thumb {
  background: var(--explore-surface);
  border: 1px solid var(--explore-border);
}
</style>
