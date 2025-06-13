import type { LngLatBounds } from "maplibre-gl";

import type { MapPoint } from "~/lib/types";

export const useMapStore = defineStore("useMapStore", () => {
  const mapPoints = ref<MapPoint[]>([]);

  const selectedPoint = ref<MapPoint | null>(null);

  const addedPoint = ref<MapPoint | null>(null);

  const flyToPoint = ref<MapPoint | null>(null);

  async function init() {
    const { useMap } = await import("@indoorequal/vue-maplibre-gl");
    const { LngLatBounds } = await import("maplibre-gl");

    let bounds: LngLatBounds | null = null;
    const map = useMap();

    effect(() => {
      const firstPoint = mapPoints.value[0];
      if (!firstPoint)
        return;
      bounds = mapPoints.value.reduce((bounds, point) => {
        return bounds.extend([point.long, point.lat]);
      }, new LngLatBounds([firstPoint.long, firstPoint.lat], [firstPoint.long, firstPoint.lat]));
      map.map?.fitBounds(bounds, { padding: 60 });
    });

    watch(addedPoint, (newValue, oldValue) => {
      if (newValue && !oldValue) {
        map.map?.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 6,
          speed: 40,
        });
      }
    });

    watch(flyToPoint, (newValue, oldValue) => {
      if (newValue) {
        map.map?.flyTo({
          center: [newValue.long, newValue.lat],
          zoom: 4,
          speed: 40,
        });
      }
      else if (!newValue && oldValue && bounds) {
        map.map?.fitBounds(bounds, { padding: 60 });
      }
    });
  }

  return {
    mapPoints,
    init,
    selectedPoint,
    addedPoint,
    flyToPoint,
  };
});
