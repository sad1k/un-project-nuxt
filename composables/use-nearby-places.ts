import type { ExploreNearbyPlace, ExploreNearbyResponse } from "~/lib/explore/nearby";

export type NearbyPlacesStatus
  = | "idle"
    | "locating"
    | "loading"
    | "ready"
    | "empty"
    | "denied"
    | "error";

export type NearbyMarkerCoords = {
  lat: number;
  lng: number;
};

const REFETCH_DEBOUNCE_MS = 350;

// Module-level shared state so the map page, the control panel, and the Mapbox
// marker handlers all read and mutate the same nearby-search session.
const isActive = ref(false);
const status = ref<NearbyPlacesStatus>("idle");
const marker = ref<NearbyMarkerCoords | null>(null);
const places = ref<ExploreNearbyPlace[]>([]);
const selectedId = ref<string | null>(null);
const addedIds = ref<string[]>([]);
const error = ref("");
// Bumped only on an explicit "find me" action so the page re-centers the camera
// then — dragging the marker refreshes results without yanking the view.
const recenterRequest = ref(0);

let fetchToken = 0;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

export function useNearbyPlaces() {
  const exploreContext = useExploreContext();
  const currentLocation = useCurrentLocation();
  const userRoutePoints = useUserRoutePoints();
  const selectedDay = useState<number | null>("explore-selected-route-day", () => null);

  async function activate() {
    isActive.value = true;
    if (!marker.value) {
      await locate();
      return;
    }
    if (!places.value.length)
      await fetchNearby();
  }

  function deactivate() {
    isActive.value = false;
    clear();
  }

  async function locate() {
    error.value = "";
    status.value = "locating";

    const coordinates = await currentLocation.requestLocation();
    if (!coordinates) {
      status.value = currentLocation.status.value === "denied" ? "denied" : "error";
      error.value = currentLocation.error.value || "Не удалось определить местоположение";
      return;
    }

    applyMarker({ lat: coordinates.lat, lng: coordinates.long });
    recenterRequest.value += 1;
    await fetchNearby();
  }

  // Called when the user drags the location marker: move the search origin and
  // refresh the surrounding places (debounced so a drag doesn't spam the API).
  function setMarker(next: NearbyMarkerCoords) {
    applyMarker(next);
    scheduleRefetch();
  }

  function applyMarker(next: NearbyMarkerCoords) {
    marker.value = next;
    // Keep the AI request context in sync so a later route generation already
    // knows where "near me" is.
    exploreContext.setCurrentLocation({
      enabled: true,
      coordinates: { lat: next.lat, long: next.lng },
    });
  }

  function scheduleRefetch() {
    if (refetchTimer)
      clearTimeout(refetchTimer);

    refetchTimer = setTimeout(() => {
      refetchTimer = null;
      void fetchNearby();
    }, REFETCH_DEBOUNCE_MS);
  }

  async function fetchNearby() {
    const origin = marker.value;
    if (!origin)
      return;

    const token = ++fetchToken;
    status.value = "loading";
    error.value = "";

    try {
      const response = await $fetch<ExploreNearbyResponse>("/api/explore/nearby-places", {
        query: {
          lat: origin.lat,
          long: origin.lng,
          interests: exploreContext.selectedInterests.value.join(","),
        },
      });

      if (token !== fetchToken)
        return;

      places.value = response.places;
      status.value = response.places.length ? "ready" : "empty";
    }
    catch {
      if (token !== fetchToken)
        return;

      places.value = [];
      status.value = "error";
      error.value = "Не удалось загрузить места рядом";
    }
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  function addPlace(place: ExploreNearbyPlace) {
    if (isAdded(place.id))
      return;

    userRoutePoints.addUserPoint({
      lat: place.coordinates.lat,
      lng: place.coordinates.long,
      day: selectedDay.value ?? 1,
      name: place.name,
    });
    addedIds.value = [...addedIds.value, place.id];
  }

  function isAdded(id: string) {
    return addedIds.value.includes(id);
  }

  function clear() {
    if (refetchTimer) {
      clearTimeout(refetchTimer);
      refetchTimer = null;
    }
    fetchToken += 1;
    marker.value = null;
    places.value = [];
    selectedId.value = null;
    addedIds.value = [];
    status.value = "idle";
    error.value = "";
  }

  return {
    isActive,
    status,
    marker,
    places,
    selectedId,
    addedIds,
    error,
    recenterRequest,
    activate,
    deactivate,
    locate,
    setMarker,
    fetchNearby,
    select,
    addPlace,
    isAdded,
    clear,
  };
}
