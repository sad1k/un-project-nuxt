import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { createUnavailablePlaceIntelligence } from "~/lib/explore/place-intelligence";

type PlaceIntelligenceState = {
  status: "idle" | "loading" | "loaded" | "error" | "unavailable";
  data: PlaceIntelligence | null;
  error: string | null;
};

export function usePlaceIntelligence() {
  const cache = useState<Record<string, PlaceIntelligenceState>>("explore-place-intelligence-cache", () => ({}));

  function cacheKey(point: RouteMapPoint, variantId: number | null | undefined) {
    return `${variantId || "draft"}:${point.sourceId}:${point.lat}:${point.lng}`;
  }

  function getState(point: RouteMapPoint, variantId: number | null | undefined) {
    return cache.value[cacheKey(point, variantId)] || {
      status: "idle",
      data: null,
      error: null,
    };
  }

  async function loadForRoutePoint(
    point: RouteMapPoint,
    variantId: number | null | undefined,
  ): Promise<PlaceIntelligence> {
    if (point.markerKind !== "generated") {
      return createUnavailablePlaceIntelligence({
        id: point.sourceId,
        name: point.name,
        day: point.day,
        coordinates: {
          lat: point.lat,
          long: point.lng,
        },
        rationale: point.rationale,
      });
    }

    const key = cacheKey(point, variantId);
    const current = cache.value[key];
    if (current?.data)
      return current.data;

    cache.value = {
      ...cache.value,
      [key]: {
        status: "loading",
        data: null,
        error: null,
      },
    };

    try {
      const data = await $fetch<PlaceIntelligence>("/api/explore/place-intelligence", {
        query: {
          variantId: variantId || undefined,
          routePointId: point.sourceId,
          name: point.name,
          day: point.day,
          lat: point.lat,
          long: point.lng,
        },
      });

      cache.value = {
        ...cache.value,
        [key]: {
          status: "loaded",
          data,
          error: null,
        },
      };

      return data;
    }
    catch (caughtError) {
      const data = createUnavailablePlaceIntelligence({
        id: point.sourceId,
        name: point.name,
        day: point.day,
        coordinates: {
          lat: point.lat,
          long: point.lng,
        },
        rationale: point.rationale,
      });

      cache.value = {
        ...cache.value,
        [key]: {
          status: "unavailable",
          data,
          error: caughtError instanceof Error ? caughtError.message : "place_intelligence_unavailable",
        },
      };

      return data;
    }
  }

  return {
    cache,
    cacheKey,
    getState,
    loadForRoutePoint,
  };
}
