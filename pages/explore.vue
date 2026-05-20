<script lang="ts" setup>
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

const mapLoaded = ref(false);
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);
const lastFittedScope = ref("");
const lastCompletedFitKey = ref("");
const routeMapPoints = computed(() => toRouteMapPoints(activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));
const selectedRouteLegs = computed(() => buildRouteLegs(selectedRoutePoints.value));

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

watch(activeVariantId, () => {
  lastFittedScope.value = "";
  lastCompletedFitKey.value = "";
});

watch(selectedDay, () => {
  lastFittedScope.value = "";
});

watch(
  [selectedRoutePoints, selectedRouteLegs, isGenerating],
  async ([pts, legs]) => {
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
    });
    mapbox.renderRoute(pts, legs);

    const scope = `${activeVariantId.value || "draft"}:${selectedDay.value || "all"}`;
    const completedFitKey = `${scope}:${pts.length}`;
    const shouldFitInitialScope = lastFittedScope.value !== scope;
    const shouldFitCompletedRoute = !isGenerating.value && lastCompletedFitKey.value !== completedFitKey;

    if (!shouldFitInitialScope && !shouldFitCompletedRoute)
      return;

    await mapbox.fitToRoute(pts);
    lastFittedScope.value = scope;

    if (!isGenerating.value)
      lastCompletedFitKey.value = completedFitKey;
  },
);

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
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <div
      v-if="!mapLoaded"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900"
    >
      <Icon
        class="animate-spin text-white"
        name="tabler:world"
        size="64"
      />
      <p class="mt-4 text-lg text-white/70">
        Loading map...
      </p>
    </div>

    <ExploreMapView @loaded="onMapLoaded" />

    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/30 to-transparent" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/20 to-transparent" />

    <ExploreHeaderOverlay />
    <div class="absolute right-4 top-20 z-30">
      <AppRouteGenerationIndicator floating />
    </div>
    <ExploreRoutePanel />
    <ExploreQuickActions />
  </div>
</template>
