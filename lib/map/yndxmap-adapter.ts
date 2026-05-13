import type { LngLatBounds, YMap } from "@yandex/ymaps3-types";
import type { YMapLocationRequest } from "@yandex/ymaps3-types/imperative/YMap";
import type { ShallowRef } from "vue";

import { getBoundsFromCoords, getLocationFromBounds } from "vue-yandex-maps";

import type { FlyToOptions, MapAdapter, MapBounds } from "./map-adapter.types";

// Default location (Moscow)
const DEFAULT_LOCATION: YMapLocationRequest = {
  center: [37.617644, 55.755819],
  zoom: 9,
};

// Helper to wait for animation
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function createYndxMapAdapter(
  map: ShallowRef<YMap | null>,
): Promise<MapAdapter | null> {
  const location = ref<YMapLocationRequest>({ ...DEFAULT_LOCATION });

  let currentBoundsLocation: { center: [number, number]; zoom: number } | null = null;

  return {
    map,
    location,

    async flyTo(options: FlyToOptions): Promise<void> {
      const zoomOutDuration = 1000;
      const zoomInDuration = 1500;

      if (currentBoundsLocation) {
        location.value = {
          center: currentBoundsLocation.center,
          zoom: currentBoundsLocation.zoom,
          duration: zoomOutDuration,
          easing: "ease-in",
        };

        await sleep(zoomOutDuration);
      }

      location.value = {
        center: options.center,
        zoom: options.zoom,
        duration: zoomInDuration,
        easing: "ease-out",
      };
    },

    async fitBounds(bounds: MapBounds): Promise<void> {
      const castedBounds = bounds._bounds as LngLatBounds;

      if (!castedBounds || !map.value) {
        return;
      }

      const { center, zoom } = await getLocationFromBounds({
        bounds: castedBounds as any,
        map: map.value,
        roundZoom: true,
        comfortZoomLevel: true,
      });

      currentBoundsLocation = { center: center as [number, number], zoom };

      location.value = {
        center,
        zoom,
        bounds: castedBounds,
        duration: 2000,
        easing: "ease-in-out",
      };
    },

    createBounds(sw: [number, number], ne: [number, number]): MapBounds {
      const coords: [number, number][] = [sw, ne];

      const createBoundsObject = (): MapBounds => ({
        extend(coord: [number, number]): MapBounds {
          coords.push(coord);
          return createBoundsObject();
        },
        get _bounds() {
          return getBoundsFromCoords(coords);
        },
      });

      return createBoundsObject();
    },

    isReady(): boolean {
      return !!map.value;
    },
  };
}
