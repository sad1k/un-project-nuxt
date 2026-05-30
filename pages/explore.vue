<script lang="ts" setup>
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";
import type { Bbox } from "~/lib/offline/bbox-from-route";
import type { OfflineRegion } from "~/lib/offline/region-store";

import { createPlacePopupHTML } from "~/components/explore/place-popup";
import {
  buildRouteLegs,
  filterRoutePointsByDay,
  findCheapestInsertionIndex,
  foldUserPointsIntoRoute,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

definePageMeta({ layout: false });

const mapbox = useMapbox();
const { activePoints, activeVariantId, generateRoute, isGenerating, restoreRouteSession, saveRoutePointToDiary, updateRoutePoint, deleteRoutePoint } = useAiRouteSession();
const { isEditMode, setEditMode } = useRouteEditMode();
const userRoutePoints = useUserRoutePoints();
const { requestContext, selectedCity } = useExploreContext();
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
const userMapPoints = computed(() => userRoutePoints.userPoints.value
  .filter(point => !selectedDay.value || point.day === selectedDay.value)
  .map((point, index) => userRoutePoints.toUserRouteMapPoint(point, index)));
// Manual stops are woven into the active route at their cheapest slot so the
// drawn walking path visits them without a big detour.
const displayPoints = computed(() => foldUserPointsIntoRoute(selectedRoutePoints.value, userMapPoints.value));
const displayLegs = computed(() => buildRouteLegs(displayPoints.value));

const editingPoint = ref<RouteMapPoint | null>(null);
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
  [displayPoints, displayLegs, isGenerating, mapbox.mapLoaded],
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
      onRemoveRequest(point) {
        if (point.markerKind === "user-place")
          userRoutePoints.removeUserPoint(point.sourceId);
        else if (isEditMode.value)
          void deleteRoutePoint(point.sourceId);
      },
      onMarkerClick(point) {
        // Manual stops have no place intelligence — managing them happens in
        // the dedicated control, so the detail sheet stays for generated stops.
        if (point.markerKind === "user-place")
          return;
        if (isEditMode.value) {
          editingPoint.value = point;
          return;
        }
        void openPlaceSheet(point);
      },
    });
    mapbox.renderRoute(pts, legs);

    // Frame on the generated base route only. Dropping a manual stop must not
    // re-zoom the map out from under the user while they place points.
    const baseLength = selectedRoutePoints.value.length;
    const scope = `${activeVariantId.value || "draft"}:${selectedDay.value || "all"}`;
    const completedFitKey = `${scope}:${baseLength}`;
    const shouldFitInitialScope = lastFittedScope.value !== scope;
    const shouldFitCompletedRoute = !isGenerating.value && lastCompletedFitKey.value !== completedFitKey;

    if ((!shouldFitInitialScope && !shouldFitCompletedRoute) || isEditMode.value)
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

watch(
  [userRoutePoints.isAddMode, mapbox.mapLoaded],
  ([addMode, loaded]) => {
    if (!loaded)
      return;
    if (addMode) {
      setEditMode(false);
      mapbox.enablePointPlacement(onPlaceUserPoint);
    }
    else {
      mapbox.disablePointPlacement();
    }
  },
  { immediate: true },
);

watch(
  [isEditMode, mapbox.mapLoaded],
  ([editMode, loaded]) => {
    if (!loaded)
      return;
    if (editMode) {
      userRoutePoints.setAddMode(false);
      mapbox.enableMarkerDragging((sourceId, lngLat) => {
        void updateRoutePoint(sourceId, { coordinates: { lat: lngLat.lat, long: lngLat.lng } });
      });
    }
    else {
      mapbox.disableMarkerDragging();
    }
  },
  { immediate: true },
);

function onPlaceUserPoint(coordinates: { lng: number; lat: number }) {
  const base = selectedRoutePoints.value;
  const index = findCheapestInsertionIndex(base, coordinates);
  const neighbor = base[index - 1] ?? base[index] ?? null;
  const day = selectedDay.value ?? neighbor?.day ?? 1;
  userRoutePoints.addUserPoint({ lat: coordinates.lat, lng: coordinates.lng, day });
}

onBeforeUnmount(() => {
  if (carouselFlyToTimer)
    clearTimeout(carouselFlyToTimer);
  mapbox.disablePointPlacement();
  userRoutePoints.setAddMode(false);
  setEditMode(false);
  mapbox.disableMarkerDragging();
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
  void mapbox.centerMap(displayPoints.value.length ? displayPoints.value : routeMapPoints.value);
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

async function regenerateRoute() {
  if (!selectedCity.value || isGenerating.value)
    return;
  await generateRoute(requestContext.value);
}

type OfflineDownloadPayload = {
  bbox: Bbox;
  estimatedBytes: number;
  pointCount: number;
};

const offlineDownloadRequest = ref<OfflineDownloadPayload | null>(null);
const offlineManagerOpen = ref(false);
const offlinePreviewRegion = ref<OfflineRegion | null>(null);

function onOfflineDownloadRequest(payload: OfflineDownloadPayload) {
  offlineDownloadRequest.value = payload;
}

function onOfflineSheetClose() {
  offlineDownloadRequest.value = null;
}

function onOfflineSheetConfirm(_payload: OfflineDownloadPayload) {
  // Region metadata is persisted inside the sheet via useOfflineRegions().
  // Real tile fetching arrives in the next slice.
  offlineDownloadRequest.value = null;
}

function onOpenOfflineManager() {
  offlineManagerOpen.value = true;
}

function onCloseOfflineManager() {
  offlineManagerOpen.value = false;
}

function onSelectOfflineRegion(region: OfflineRegion) {
  if (region.status === "complete" && region.tilesDone) {
    offlinePreviewRegion.value = region;
    offlineManagerOpen.value = false;
    return;
  }

  // Region not fully downloaded — fall back to flying the main Mapbox
  // globe to the bbox centre so the user at least sees the area.
  const [west, south, east, north] = region.bbox;
  mapbox.flyToPoint(
    { lat: (south + north) / 2, lng: (west + east) / 2 },
    { zoom: 9, duration: 900 },
  );
  offlineManagerOpen.value = false;
}

function onCloseOfflinePreview() {
  offlinePreviewRegion.value = null;
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

    <OfflineBanner floating />

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

    <div class="pointer-events-none absolute bottom-6 left-[80px] z-30 flex flex-col gap-2 max-md:bottom-[96px] max-md:left-3">
      <ExploreManualPointsControl />
      <ExploreRouteEditControl />
      <OfflineDownloadTrigger
        :route-points="selectedRoutePoints"
        @request="onOfflineDownloadRequest"
        @open-manager="onOpenOfflineManager"
      />
      <OfflineRegionsTrigger @open="onOpenOfflineManager" />
    </div>

    <ExploreWizard />
    <AppSideRail mode="overlay" />
    <AppMobileToolbar />

    <Transition name="place-sheet">
      <div
        v-if="editingPoint"
        class="explore-popover pointer-events-auto absolute bottom-6 left-[80px] z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border p-3 max-md:bottom-[96px] max-md:left-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-semibold">{{ editingPoint.name }}</span>
          <button
            class="explore-text-soft rounded-md p-1 transition hover:text-[var(--explore-danger-text)]"
            type="button"
            @click="editingPoint = null"
          >
            <Icon name="tabler:x" size="14" />
          </button>
        </div>
        <ExploreRoutePointEditor
          :point="editingPoint"
          @submit="(patch) => { updateRoutePoint(editingPoint!.sourceId, patch); editingPoint = null; }"
          @cancel="editingPoint = null"
        />
      </div>
    </Transition>

    <ExplorePlaceBottomSheet
      :place="selectedSheetPlace"
      :intelligence="selectedSheetIntelligence"
      :loading="selectedSheetLoading"
      :editable="isEditMode"
      @close="closePlaceSheet"
      @save="onSheetSave"
      @directions="onSheetDirections"
      @story="onSheetStory"
      @edit="editingPoint = $event"
      @delete="deleteRoutePoint($event.sourceId)"
    />

    <ExploreRouteStepCarousel
      @open-details="openPlaceSheet"
      @save="onSheetSave"
      @directions="onSheetDirections"
      @retry="regenerateRoute"
    />

    <OfflineDownloadSheet
      :payload="offlineDownloadRequest"
      :region-label="selectedCity?.label"
      @close="onOfflineSheetClose"
      @confirm="onOfflineSheetConfirm"
    />

    <OfflineRegionsManager
      :open="offlineManagerOpen"
      @close="onCloseOfflineManager"
      @select="onSelectOfflineRegion"
    />

    <OfflineRegionPreview
      :region="offlinePreviewRegion"
      @close="onCloseOfflinePreview"
    />
  </div>
</template>
