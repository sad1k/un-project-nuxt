import type { MapAdapter, MapBounds } from "~/lib/map";
import type { MapPoint } from "~/lib/types";

import { defaultMapAdapterFactory } from "~/lib/map";

export const useMapStore = defineStore("useMapStore", () => {
  const mapPoints = ref<MapPoint[]>([]);

  const selectedPoint = ref<MapPoint | null>(null);

  const addedPoint = ref<MapPoint | null>(null);

  const flyToPoint = ref<MapPoint | null>(null);

  // Store the adapter instance
  const adapter = ref<MapAdapter | null>(null);

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
      if (newValue && !oldValue && adapter.value) {
        adapter.value.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 6,
          speed: 40,
        });
      }
    });

    watch(flyToPoint, (newValue, oldValue) => {
      if (newValue && adapter.value) {
        console.log("flying to point", newValue);
        adapter.value.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 13,
          speed: 2,
        });
      }
      else if (!newValue && oldValue && bounds && adapter.value) {
        adapter.value.fitBounds(bounds, { padding: 60 });
      }
    });
  }

  return {
    mapPoints,
    init,
    selectedPoint,
    addedPoint,
    flyToPoint,
    adapter,
  };
});
