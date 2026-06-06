import type { PlaceIntelligence, PlacePhoto } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { createUnavailablePlaceIntelligence } from "~/lib/explore/place-intelligence";

type PlaceIntelligenceState = {
  status: "idle" | "loading" | "loaded" | "error" | "unavailable";
  data: PlaceIntelligence | null;
  error: string | null;
};

export type PlacePopupLoadingFlags = {
  details?: boolean;
  photo?: boolean;
};

export type ProgressivePlaceUpdate = {
  intelligence: PlaceIntelligence;
  loading: PlacePopupLoadingFlags;
};

// Photos are by far the slowest part of a place card. Resolve them through one shared, deduped
// promise cache keyed by place identity (not variant/day) so a photo requested while the route is
// still streaming in is reused the instant its popup opens, and the same place never hits the
// provider chain twice. The request also warms the server-side place-media cache, which speeds up
// the bottom-sheet path (/api/explore/place-intelligence) for free.
const photoResolutionCache = new Map<string, Promise<PlacePhoto | null>>();

function placePhotoKey(point: Pick<RouteMapPoint, "name" | "lat" | "lng">) {
  return `${point.name.trim().toLowerCase()}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
}

function resolvePlacePhoto(point: Pick<RouteMapPoint, "name" | "lat" | "lng">): Promise<PlacePhoto | null> {
  const key = placePhotoKey(point);
  const inFlight = photoResolutionCache.get(key);
  if (inFlight)
    return inFlight;

  const request = $fetch<{ photo: PlacePhoto | null }>("/api/explore/place-photo-resolve", {
    query: { name: point.name, lat: point.lat, long: point.lng },
  })
    .then(data => data.photo ?? null)
    .catch(() => null);

  photoResolutionCache.set(key, request);
  return request;
}

// Background warming is throttled so restoring a saved multi-day route doesn't fire the whole
// (paid, quota-capped) provider chain at once. An actively opened popup calls resolvePlacePhoto
// directly and bypasses this queue, so it never waits behind background prefetches.
const PHOTO_PREFETCH_CONCURRENCY = 3;
const scheduledPhotoKeys = new Set<string>();
const photoPrefetchQueue: Array<() => Promise<unknown>> = [];
let activePhotoPrefetches = 0;

function pumpPhotoPrefetchQueue() {
  while (activePhotoPrefetches < PHOTO_PREFETCH_CONCURRENCY) {
    const task = photoPrefetchQueue.shift();
    if (!task)
      return;
    activePhotoPrefetches += 1;
    void task().finally(() => {
      activePhotoPrefetches -= 1;
      pumpPhotoPrefetchQueue();
    });
  }
}

function prefetchPhotoForRoutePoint(point: RouteMapPoint) {
  // Only generated stops have real provider photos, and prefetching is a pure client concern.
  if (!import.meta.client || point.markerKind !== "generated")
    return;

  const key = placePhotoKey(point);
  if (scheduledPhotoKeys.has(key) || photoResolutionCache.has(key))
    return;

  scheduledPhotoKeys.add(key);
  photoPrefetchQueue.push(() => resolvePlacePhoto(point));
  pumpPhotoPrefetchQueue();
}

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

  async function loadForRoutePointProgressive(
    point: RouteMapPoint,
    variantId: number | null | undefined,
    onUpdate: (update: ProgressivePlaceUpdate) => void,
  ): Promise<PlaceIntelligence> {
    const fallback = () => createUnavailablePlaceIntelligence({
      id: point.sourceId,
      name: point.name,
      day: point.day,
      coordinates: { lat: point.lat, long: point.lng },
      rationale: point.rationale,
    });

    if (point.markerKind !== "generated") {
      const data = fallback();
      onUpdate({ intelligence: data, loading: {} });
      return data;
    }

    const key = cacheKey(point, variantId);
    const cached = cache.value[key];
    if (cached?.data) {
      onUpdate({ intelligence: cached.data, loading: {} });
      return cached.data;
    }

    // Fire the fast intelligence payload and the slow photo chain in parallel; paint a skeleton
    // immediately and re-emit as each lands so the card fills section-by-section.
    let details = fallback();
    let photo: PlacePhoto | null = null;
    let detailsDone = false;
    let photoDone = false;

    const emit = () => {
      // Hide the "photo unavailable" slot while the photo is still loading or once it arrives;
      // only surface it after the photo request finishes empty.
      const missingSlots = (!photoDone || photo)
        ? details.missingSlots.filter(slot => slot.key !== "photo")
        : details.missingSlots;
      onUpdate({
        intelligence: { ...details, photo: photo ?? details.photo ?? null, missingSlots },
        loading: { details: !detailsDone, photo: !photoDone },
      });
    };

    emit();

    cache.value = {
      ...cache.value,
      [key]: { status: "loading", data: null, error: null },
    };

    const detailsPromise = $fetch<PlaceIntelligence>("/api/explore/place-intelligence", {
      query: {
        variantId: variantId || undefined,
        routePointId: point.sourceId,
        name: point.name,
        day: point.day,
        lat: point.lat,
        long: point.lng,
        withPhoto: 0,
      },
    })
      .then((data) => { details = data; })
      .catch(() => { /* keep the unavailable skeleton as the details payload */ })
      .finally(() => {
        detailsDone = true;
        emit();
      });

    // Reuse the shared resolver: if this place was prefetched while the route streamed in, we
    // join the in-flight (or already-resolved) request instead of starting the slow chain over.
    const photoPromise = resolvePlacePhoto(point)
      .then((resolved) => { photo = resolved; })
      .finally(() => {
        photoDone = true;
        emit();
      });

    await Promise.all([detailsPromise, photoPromise]);

    const finalSlots = photo
      ? details.missingSlots.filter(slot => slot.key !== "photo")
      : details.missingSlots;
    const finalData: PlaceIntelligence = { ...details, photo: photo ?? null, missingSlots: finalSlots };

    cache.value = {
      ...cache.value,
      [key]: { status: "loaded", data: finalData, error: null },
    };

    return finalData;
  }

  return {
    cache,
    cacheKey,
    getState,
    loadForRoutePoint,
    loadForRoutePointProgressive,
    prefetchPhotoForRoutePoint,
  };
}
