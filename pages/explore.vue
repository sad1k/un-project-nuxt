<script lang="ts" setup>
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { createPlacePopupHTML } from "~/components/explore/place-popup";
import {
  buildRouteLegs,
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

definePageMeta({ layout: false });

const mapbox = useMapbox();
const { activePoints, activeVariantId, isGenerating, restoreRouteSession, saveRoutePointToDiary } = useAiRouteSession();
const placeIntelligence = usePlaceIntelligence();
const route = useRoute();
const colorMode = useColorMode();

const mapLoaded = ref(false);
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);
const lastFittedScope = ref("");
const lastCompletedFitKey = ref("");
const CAROUSEL_FLYTO_SUPPRESSION_MS = 800;
const isCarouselDriven = ref(false);
let carouselFlyToTimer: ReturnType<typeof setTimeout> | null = null;
const routeMapPoints = computed(() => toRouteMapPoints(activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const selectedRouteLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));

const selectedSheetPlace = ref<RouteMapPoint | null>(null);
const selectedSheetIntelligence = ref<PlaceIntelligence | null>(null);
const selectedSheetLoading = ref(false);
let sheetLoadToken = 0;
const mapControlButtonClass = "explore-control flex h-10 w-10 items-center justify-center shadow-lg backdrop-blur-xl transition hover:text-brand-gold";

function onMapLoaded() {
  mapLoaded.value = true;
}

onMounted(() => {
  void restoreRouteSession(readRouteSessionIdQuery(route.query.sessionId));
});

watch(
  () => route.query.sessionId,
  (nextSessionId) => {
    void restoreRouteSession(readRouteSessionIdQuery(nextSessionId));
  },
);

watch(activeVariantId, async () => {
  lastFittedScope.value = "";
  lastCompletedFitKey.value = "";
  closePlaceSheet();
  await nextTick();
  if (!mapbox.mapLoaded.value)
    return;
  const points = selectedRoutePoints.value.length ? selectedRoutePoints.value : routeMapPoints.value;
  if (points.length)
    await mapbox.fitToRoute(points);
});

watch(
  () => colorMode.value,
  (theme) => {
    mapbox.setMapTheme(theme === "light" ? "light" : "dark");
  },
  { immediate: true },
);

watch(selectedDay, () => {
  lastFittedScope.value = "";
});

watch(
  [selectedRoutePoints, selectedRouteLegs, isGenerating, mapbox.mapLoaded],
  async ([pts, legs]) => {
    if (!mapbox.mapLoaded.value)
      return;

    if (!pts.length) {
      mapbox.clearMarkers();
      mapbox.clearRoute();
      return;
    }

    await mapbox.addMarkers(pts, {
      async getPopupHTML(point) {
        if (point.markerKind !== "generated")
          return "";

        const intelligence = await placeIntelligence.loadForRoutePoint(point, activeVariantId.value);
        return createPlacePopupHTML(intelligence, { includeStoryCta: true });
      },
      async onSaveRequest(point) {
        await saveRoutePointFromPopup(point);
      },
      onDirectionsRequest(point, nextPoint) {
        openDirectionsToNextStop(point, nextPoint);
      },
      onStoryRequest(point) {
        selectedDay.value = point.day;
        selectedStoryRoutePointId.value = point.sourceId;
      },
      onMarkerClick(point) {
        void openPlaceSheet(point);
      },
    });
    mapbox.renderRoute(pts, legs);

    const scope = `${activeVariantId.value || "draft"}:${selectedDay.value || "all"}`;
    const completedFitKey = `${scope}:${pts.length}`;
    const shouldFitInitialScope = lastFittedScope.value !== scope;
    const shouldFitCompletedRoute = !isGenerating.value && lastCompletedFitKey.value !== completedFitKey;

    if (!shouldFitInitialScope && !shouldFitCompletedRoute)
      return;

    if (isCarouselDriven.value) {
      lastFittedScope.value = scope;
      if (!isGenerating.value)
        lastCompletedFitKey.value = completedFitKey;
      return;
    }

    await mapbox.fitToRoute(pts);
    lastFittedScope.value = scope;

    if (!isGenerating.value)
      lastCompletedFitKey.value = completedFitKey;
  },
);

watch(selectedStoryRoutePointId, (sourceId) => {
  if (!sourceId || !mapbox.mapLoaded.value)
    return;
  const point = selectedRoutePoints.value.find(p => p.sourceId === sourceId);
  if (!point)
    return;

  isCarouselDriven.value = true;
  if (carouselFlyToTimer)
    clearTimeout(carouselFlyToTimer);
  carouselFlyToTimer = setTimeout(() => {
    isCarouselDriven.value = false;
  }, CAROUSEL_FLYTO_SUPPRESSION_MS);

  mapbox.flyToPoint({ lat: point.lat, lng: point.lng });
});

onBeforeUnmount(() => {
  if (carouselFlyToTimer)
    clearTimeout(carouselFlyToTimer);
});

watch(routeMapPoints, (points) => {
  if (!selectedDay.value)
    return;

  if (!points.some(point => point.day === selectedDay.value))
    selectedDay.value = null;
});

function readRouteSessionIdQuery(input: unknown) {
  const value = Array.isArray(input) ? input[0] : input;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function zoomInMap() {
  mapbox.zoomIn();
}

async function saveRoutePointFromPopup(point: RouteMapPoint) {
  if (point.markerKind !== "generated")
    return;

  await saveRoutePointToDiary(point.sourceId);
}

function openDirectionsToNextStop(point: RouteMapPoint, nextPoint: RouteMapPoint | null) {
  if (!nextPoint)
    return;

  window.open(createDirectionsUrl(point, nextPoint), "_blank", "noopener,noreferrer");
}

function createDirectionsUrl(point: RouteMapPoint, nextPoint: RouteMapPoint) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${nextPoint.lat},${nextPoint.lng}`,
    origin: `${point.lat},${point.lng}`,
    travelmode: "walking",
  });

  return `https://www.google.com/maps/dir/?${params}`;
}

function zoomOutMap() {
  mapbox.zoomOut();
}

function centerMap() {
  void mapbox.centerMap(selectedRoutePoints.value.length ? selectedRoutePoints.value : routeMapPoints.value);
}

function toggleMapLayer() {
  mapbox.toggleMapStyle();
}

async function openPlaceSheet(point: RouteMapPoint) {
  selectedSheetPlace.value = point;
  selectedSheetIntelligence.value = null;
  selectedSheetLoading.value = point.markerKind === "generated";

  if (point.markerKind !== "generated")
    return;

  const token = ++sheetLoadToken;
  try {
    const intelligence = await placeIntelligence.loadForRoutePoint(point, activeVariantId.value);
    if (token !== sheetLoadToken)
      return;
    selectedSheetIntelligence.value = intelligence;
  }
  finally {
    if (token === sheetLoadToken)
      selectedSheetLoading.value = false;
  }
}

function closePlaceSheet() {
  sheetLoadToken += 1;
  selectedSheetPlace.value = null;
  selectedSheetIntelligence.value = null;
  selectedSheetLoading.value = false;
}

function onSheetSave(point: RouteMapPoint) {
  void saveRoutePointFromPopup(point);
}

function onSheetDirections(point: RouteMapPoint) {
  const index = selectedRoutePoints.value.findIndex(item => item.sourceId === point.sourceId);
  const nextPoint = index >= 0 ? selectedRoutePoints.value[index + 1] ?? null : null;
  openDirectionsToNextStop(point, nextPoint);
}

function onSheetStory(point: RouteMapPoint) {
  selectedDay.value = point.day;
  selectedStoryRoutePointId.value = point.sourceId;
  closePlaceSheet();
}
</script>

<template>
  <div class="explore-shell relative h-screen w-screen overflow-hidden">
    <div
      v-if="!mapLoaded"
      class="explore-loading-scrim pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center"
    >
      <Icon
        class="animate-spin text-brand-gold"
        name="tabler:compass"
        size="64"
      />
      <p class="explore-text-soft mt-4 font-mono text-xs uppercase tracking-[0.28em]">
        Loading map
      </p>
    </div>

    <ExploreMapView @loaded="onMapLoaded" />

    <div class="explore-top-scrim pointer-events-none absolute inset-x-0 top-0 z-10 h-24" />
    <div class="explore-bottom-scrim pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28" />

    <div class="absolute left-[72px] right-3 top-3 z-40 flex items-center justify-end gap-2 max-md:left-3">
      <AppGlobalSearch class="min-w-0 flex-1 sm:max-w-[440px]" />
      <AppThemeToggle />
      <AppUserMenu />
    </div>

    <div class="absolute right-4 top-20 z-30 flex items-center gap-2">
      <AppRouteGenerationIndicator floating />
      <ExploreResultsActions />
    </div>

    <div class="absolute left-[80px] top-24 z-20 flex flex-col gap-2 max-md:hidden">
      <div class="explore-map-controls-group flex flex-col overflow-hidden rounded-xl border backdrop-blur-xl">
        <button
          aria-label="Приблизить"
          class="border-0 border-b rounded-none rounded-t-xl"
          :class="[mapControlButtonClass]"
          data-testid="explore-map-zoom-in"
          type="button"
          @click="zoomInMap"
        >
          <Icon name="tabler:plus" size="14" />
        </button>
        <div class="explore-map-divider h-px" />
        <button
          aria-label="Отдалить"
          class="border-0 rounded-none rounded-b-xl"
          :class="[mapControlButtonClass]"
          data-testid="explore-map-zoom-out"
          type="button"
          @click="zoomOutMap"
        >
          <Icon name="tabler:minus" size="14" />
        </button>
      </div>
      <button
        aria-label="Центрировать карту"
        class="rounded-xl border"
        :class="mapControlButtonClass"
        data-testid="explore-map-center"
        type="button"
        @click="centerMap"
      >
        <Icon name="tabler:compass" size="14" />
      </button>
      <button
        aria-label="Слои карты"
        class="rounded-xl border"
        :class="mapControlButtonClass"
        data-testid="explore-map-layers"
        type="button"
        @click="toggleMapLayer"
      >
        <Icon name="tabler:layers-subtract" size="14" />
      </button>
    </div>

    <ExploreWizard />
    <AppSideRail mode="overlay" />
    <AppMobileToolbar />

    <ExplorePlaceBottomSheet
      :place="selectedSheetPlace"
      :intelligence="selectedSheetIntelligence"
      :loading="selectedSheetLoading"
      @close="closePlaceSheet"
      @save="onSheetSave"
      @directions="onSheetDirections"
      @story="onSheetStory"
    />

    <ExploreRouteStepCarousel
      @open-details="openPlaceSheet"
      @save="onSheetSave"
      @directions="onSheetDirections"
    />
  </div>
</template>
