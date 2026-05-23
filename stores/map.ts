import type { MapAdapter, MapBounds } from "~/lib/map";
import type { MapPoint } from "~/lib/types";

import { defaultMapAdapterFactory } from "~/lib/map";

export const useMapStore = defineStore("useMapStore", () => {
  const mapPoints = ref<MapPoint[]>([]);

  const selectedPoint = ref<MapPoint | null>(null);

  const addedPoint = ref<MapPoint | null>(null);

  const flyToPoint = ref<MapPoint | null>(null);

  const suppressAddedPointFly = ref(false);

  const adapter = ref<MapAdapter | null>(null);

  const mobileSheetState = ref<"collapsed" | "peek" | "expanded">("collapsed");

  function showMapPeek() {
    if (mobileSheetState.value === "collapsed")
      mobileSheetState.value = "peek";
  }

  function collapseMap() {
    mobileSheetState.value = "collapsed";
  }

  function toggleMobileSheet() {
    mobileSheetState.value = mobileSheetState.value === "collapsed" ? "peek" : "collapsed";
  }

  async function init(customAdapterFactory = defaultMapAdapterFactory) {
    adapter.value = await customAdapterFactory();

    let bounds: MapBounds | null = null;

    effect(() => {
      const firstPoint = mapPoints.value[0];
      if (!firstPoint || !adapter.value)
        return;
      bounds = mapPoints.value.reduce((currentBounds, point) => {
        return currentBounds.extend([point.long, point.lat]);
      }, adapter.value.createBounds(
        [firstPoint.long, firstPoint.lat],
        [firstPoint.long, firstPoint.lat],
      ));
      adapter.value.fitBounds(bounds, { padding: 60 });
    });

    watch(addedPoint, (newValue, oldValue) => {
      if (newValue && !oldValue && adapter.value && !suppressAddedPointFly.value) {
        void adapter.value.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 6,
          duration: 1500,
        });
      }
    });

    watch(flyToPoint, async (newValue, oldValue) => {
      if (newValue && adapter.value) {
        await adapter.value.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 14,
          duration: 1500,
        });
      }
      else if (!newValue && oldValue && bounds && adapter.value) {
        await adapter.value.fitBounds(bounds, { padding: 60 });
      }
    });
  }

  return {
    mapPoints,
    init,
    selectedPoint,
    addedPoint,
    flyToPoint,
    suppressAddedPointFly,
    adapter,
    mobileSheetState,
    showMapPeek,
    collapseMap,
    toggleMobileSheet,
  };
});
