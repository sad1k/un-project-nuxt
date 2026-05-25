<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

import {
  buildRouteLegs,
  filterRoutePointsByDay,
  getRouteDayGroups,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const emit = defineEmits<{
  openDetails: [point: RouteMapPoint];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
  retry: [];
}>();

const aiRouteSession = useAiRouteSession();
const placeIntelligence = usePlaceIntelligence();
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);

const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const routeLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));
const routeDayGroups = computed(() => getRouteDayGroups(routeMapPoints.value));

const activeIndex = computed(() => selectedRoutePoints.value.findIndex(
  p => p.sourceId === selectedStoryRoutePointId.value,
));

const headerLabel = computed(() => {
  if (aiRouteSession.isGenerating.value)
    return "Генерируем маршрут…";

  const total = selectedRoutePoints.value.length;
  if (!total)
    return "";

  const stepIndex = Math.max(0, activeIndex.value);
  const point = selectedRoutePoints.value[stepIndex];
  if (!point)
    return `Шаг 1 из ${total}`;

  return `День ${point.day} · Шаг ${stepIndex + 1} из ${total}`;
});

function setDay(day: number | null) {
  selectedDay.value = day;
}

const trackRef = ref<HTMLElement | null>(null);
const cardRefs = ref<Record<string, HTMLElement>>({});
let observer: IntersectionObserver | null = null;
const USER_SCROLL_WINDOW_MS = 300;
let lastUserScrollAt = 0;

function registerCard(point: RouteMapPoint, el: Element | null) {
  if (!el) {
    delete cardRefs.value[point.sourceId];
    return;
  }
  cardRefs.value[point.sourceId] = el as HTMLElement;
}

function setupObserver() {
  if (!import.meta.client)
    return;
  observer?.disconnect();
  if (!trackRef.value)
    return;

  observer = new IntersectionObserver(
    (entries) => {
      if (performance.now() - lastUserScrollAt > USER_SCROLL_WINDOW_MS)
        return;
      const top = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!top)
        return;
      const sourceId = (top.target as HTMLElement).dataset.sourceId;
      if (sourceId && sourceId !== selectedStoryRoutePointId.value)
        selectedStoryRoutePointId.value = sourceId;
    },
    { root: trackRef.value, threshold: [0.6, 0.9] },
  );

  Object.values(cardRefs.value).forEach(el => observer?.observe(el));
}

function onTrackScroll() {
  lastUserScrollAt = performance.now();
}

onMounted(() => {
  setupObserver();
});

watch(selectedRoutePoints, async () => {
  await nextTick();
  setupObserver();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

const showCarousel = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));

function heroImageFor(point: RouteMapPoint): string | null {
  if (point.markerKind !== "generated")
    return null;
  return placeIntelligence.getState(point, aiRouteSession.activeVariantId.value).data?.photo?.url ?? null;
}

watch(
  [selectedStoryRoutePointId, selectedRoutePoints],
  () => {
    if (activeIndex.value < 0)
      return;
    const points = selectedRoutePoints.value;
    const slice = [
      points[activeIndex.value - 2],
      points[activeIndex.value - 1],
      points[activeIndex.value],
      points[activeIndex.value + 1],
      points[activeIndex.value + 2],
    ].filter((p): p is RouteMapPoint => Boolean(p));
    slice.forEach((point) => {
      if (point.markerKind !== "generated")
        return;
      void placeIntelligence.loadForRoutePoint(point, aiRouteSession.activeVariantId.value);
    });
  },
  { immediate: true },
);

watch(selectedStoryRoutePointId, async (sourceId) => {
  if (!sourceId)
    return;
  await nextTick();
  const card = cardRefs.value[sourceId];
  const track = trackRef.value;
  if (!card || !track)
    return;

  const trackRect = track.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const trackCenter = trackRect.left + trackRect.width / 2;
  const cardCenter = cardRect.left + cardRect.width / 2;
  if (Math.abs(trackCenter - cardCenter) < 8)
    return;

  const reduced = import.meta.client
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  lastUserScrollAt = 0;
  card.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "nearest",
    inline: "center",
  });
});

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

function openCard(point: RouteMapPoint) {
  onSelectCard(point);
  emit("openDetails", point);
}
</script>

<template>
  <section
    v-if="showCarousel"
    class="route-step-carousel pointer-events-auto fixed inset-x-0 bottom-[80px] z-30 md:hidden"
    data-testid="explore-route-step-carousel"
  >
    <header class="route-step-header flex flex-col gap-1.5 px-3 pt-1">
      <div class="route-step-handle mx-auto h-1.5 w-10 rounded-full" />

      <div
        v-if="routeDayGroups.length > 1"
        class="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5"
      >
        <button
          class="route-step-day-chip explore-chip flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition"
          :class="selectedDay === null ? 'explore-chip-active' : ''"
          :aria-pressed="selectedDay === null"
          type="button"
          @click="setDay(null)"
        >
          Все
        </button>
        <button
          v-for="group in routeDayGroups"
          :key="group.day"
          class="route-step-day-chip explore-chip flex h-7 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition"
          :class="selectedDay === group.day ? 'explore-chip-active' : ''"
          :aria-pressed="selectedDay === group.day"
          :aria-label="`День ${group.day}`"
          type="button"
          @click="setDay(group.day)"
        >
          Д{{ group.day }}
        </button>
      </div>

      <div class="flex items-center justify-between">
        <span class="explore-text-soft text-[11px] font-medium">{{ headerLabel }}</span>
        <div v-if="selectedRoutePoints.length > 1" class="flex items-center gap-1">
          <span
            v-for="(_, index) in selectedRoutePoints"
            :key="index"
            class="h-1 rounded-full transition-all"
            :class="index === Math.max(0, activeIndex)
              ? 'w-3 bg-[var(--explore-text)]'
              : 'w-1 bg-[var(--explore-border-strong)]'"
          />
        </div>
      </div>
    </header>

    <div
      v-if="aiRouteSession.lastWarning.value"
      class="route-step-warning explore-status-warning mx-3 mb-1 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px]"
    >
      <Icon name="tabler:alert-triangle" size="13" />
      <span class="truncate">{{ aiRouteSession.lastWarning.value }}</span>
    </div>

    <div
      v-if="aiRouteSession.error.value"
      class="route-step-error explore-status-danger mx-3 my-2 flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-sm"
    >
      <span class="truncate">{{ aiRouteSession.error.value }}</span>
      <button
        class="explore-primary-button h-8 shrink-0 rounded-full px-3 text-xs font-bold"
        type="button"
        @click="emit('retry')"
      >
        Повторить
      </button>
    </div>

    <ol
      v-else
      ref="trackRef"
      class="route-step-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[10vw] pb-3 pt-2"
      data-testid="explore-route-step-track"
      @scroll.passive="onTrackScroll"
    >
      <template v-if="aiRouteSession.isGenerating.value && !selectedRoutePoints.length">
        <li
          v-for="i in 3"
          :key="`skeleton-${i}`"
          class="route-step-card-slot snap-center shrink-0 px-1.5"
          style="flex-basis: 84%;"
        >
          <div class="route-step-card route-step-skeleton flex w-full items-stretch gap-3 rounded-2xl border p-3">
            <div class="route-step-thumb h-16 w-16 shrink-0 rounded-xl" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="route-step-skeleton-bar h-3 w-2/3 rounded-full" />
              <div class="route-step-skeleton-bar h-2 w-1/2 rounded-full" />
              <div class="route-step-skeleton-bar h-6 w-3/4 rounded-full" />
            </div>
          </div>
        </li>
      </template>

      <li
        v-for="(point, index) in selectedRoutePoints"
        :key="point.id"
        :ref="(el) => registerCard(point, el as Element | null)"
        :data-source-id="point.sourceId"
        class="route-step-card-slot snap-center shrink-0 px-1.5"
        style="flex-basis: 84%;"
      >
        <article
          class="route-step-card explore-card flex w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition"
          :class="point.sourceId === selectedStoryRoutePointId ? 'route-step-card-active' : ''"
          role="button"
          tabindex="0"
          @click="openCard(point)"
          @keydown.enter.prevent="openCard(point)"
          @keydown.space.prevent="openCard(point)"
        >
          <div class="route-step-thumb flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <img
              v-if="heroImageFor(point)"
              :alt="point.name"
              class="h-full w-full object-cover"
              loading="lazy"
              :src="heroImageFor(point) ?? ''"
            >
            <Icon
              v-else
              class="explore-text-faint"
              name="tabler:photo"
              size="22"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px]"
                :class="point.sourceId === selectedStoryRoutePointId
                  ? 'bg-brand-emerald text-[var(--explore-primary-text)]'
                  : isLast(index)
                    ? 'bg-brand-sangria text-[var(--explore-primary-text)]'
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
        </article>
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
.route-step-handle {
  background: var(--explore-border-strong);
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}
.route-step-skeleton-bar,
.route-step-skeleton .route-step-thumb {
  background: linear-gradient(
    90deg,
    var(--explore-surface) 0%,
    var(--explore-surface-strong) 50%,
    var(--explore-surface) 100%
  );
  background-size: 200% 100%;
  animation: route-step-shimmer 1.4s ease-in-out infinite;
}
@keyframes route-step-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
