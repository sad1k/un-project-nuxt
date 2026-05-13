import type { ExploreCoordinates } from "~/lib/explore/search";

const status = ref<"idle" | "loading" | "ready" | "denied" | "error">("idle");
const coordinates = ref<ExploreCoordinates | null>(null);
const error = ref("");

export function useCurrentLocation() {
  async function requestLocation() {
    error.value = "";

    if (!import.meta.client || !("geolocation" in navigator)) {
      status.value = "error";
      error.value = "Current location is not available";
      return null;
    }

    status.value = "loading";

    return await new Promise<ExploreCoordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextCoordinates = {
            lat: position.coords.latitude,
            long: position.coords.longitude,
          };
          coordinates.value = nextCoordinates;
          status.value = "ready";
          resolve(nextCoordinates);
        },
        (geoError) => {
          status.value = geoError.code === geoError.PERMISSION_DENIED ? "denied" : "error";
          error.value = "Could not read current location";
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          maximumAge: 300000,
          timeout: 10000,
        },
      );
    });
  }

  return {
    status,
    coordinates,
    error,
    requestLocation,
  };
}
