import type { LngLatBounds } from "maplibre-gl";

import type { FitBoundsOptions, FlyToOptions, MapAdapter, MapBounds } from "./map-adapter.types";

export async function createMaplibreAdapter(): Promise<MapAdapter | null> {
  const { useMap } = await import("@indoorequal/vue-maplibre-gl");
  const { LngLatBounds } = await import("maplibre-gl");

  const mapContext = useMap();

  return {
    map: mapContext.map,
    flyTo(options: FlyToOptions): void {
      mapContext.map?.flyTo({
        center: options.center,
        zoom: options.zoom,
        speed: options.speed ?? 2,
      });
    },

    fitBounds(bounds: MapBounds, options?: FitBoundsOptions): void {
      mapContext.map?.fitBounds(bounds as LngLatBounds, {
        padding: options?.padding ?? 60,
      });
    },

    createBounds(sw: [number, number], ne: [number, number]): MapBounds {
      return new LngLatBounds(sw, ne);
    },

    isReady(): boolean {
      return !!mapContext.map;
    },
  };
}
