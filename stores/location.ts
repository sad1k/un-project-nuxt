import type {
  SelectLocation,
  SelectLocationLog,
  SelectLocationWithLogs,
} from "~/lib/db/schema";
import type { MapPoint } from "~/lib/types";

import {
  CURRENT_LOCATION_LOG_PAGES,
  CURRENT_LOCATION_PAGES,
  LOCATION_PAGES,
} from "~/lib/constants";

import type { SidebarItem } from "./sidebar";

export const useLocationStore = defineStore("useLocationStore", () => {
  const route = useRoute();

  const {
    data: locations,
    status: locationsStatus,
    refresh: locationsRefresh,
  } = useFetch("/api/locations", {
    lazy: true,
  });

  const sidebarStore = useSidebarStore();
  const mapStore = useMapStore();

  const currentLocationSlug = computed(() => {
    const slug = route.params.slug;
    return slug ? `/api/locations/${slug}` : "";
  });

  const currentLocationLogId = computed(() => {
    const id = route.params.id;
    return id ? `/api/locations/${route.params.slug}/${id}` : "";
  });

  const {
    data: currentLocation,
    status: currentLocationStatus,
    error: currentLocationError,
    refresh: currentLocationRefresh,
  } = useFetch<SelectLocationWithLogs>(currentLocationSlug, {
    lazy: true,
    immediate: false,
    watch: [() => route.params.slug],
  });

  const {
    data: currentLocationLog,
    status: currentLocationLogStatus,
    error: currentLocationLogError,
    refresh: currentLocationLogRefresh,
  } = useFetch<SelectLocationLog>(currentLocationLogId, {
    lazy: true,
    immediate: false,
    watch: [() => route.params.id],
  });

  effect(() => {
    console.log(route.name?.toString(), "route.name");
    if (
      locations.value
      && LOCATION_PAGES.includes(route.name?.toString() || "")
    ) {
      const mapPoints: MapPoint[] = [];
      const sidebarItems: SidebarItem[] = [];
      locations.value.forEach((location) => {
        const mapPoint = createMapPointFromLocation(location);
        mapPoints.push(mapPoint);
        sidebarItems.push({
          label: location.name,
          icon: "tabler:map-pin-filled",
          id: `location-${location.id}`,
          to: {
            name: "dashboard-location-slug",
            params: { slug: location.slug },
          },
          mapPoint,
        });
      });
      mapStore.mapPoints = mapPoints;
      sidebarStore.sidebarItems = sidebarItems;
    }
    else if (
      currentLocation.value
      && CURRENT_LOCATION_PAGES.includes(route.name?.toString() || "")
    ) {
      const mapPoints: MapPoint[] = [];
      const sidebarItems: SidebarItem[] = [];
      currentLocation.value.locationLogs.forEach((locationLog) => {
        const mapPoint = createMapPointFromLocationLog(
          locationLog,
          currentLocation.value?.slug || "",
        );
        mapPoints.push(mapPoint);
        sidebarItems.push({
          label: locationLog.name,
          icon: "tabler:map-pin-filled",
          id: `location-log-${locationLog.id}`,
          to: {
            name: "dashboard-location-slug-id",
            params: { id: locationLog.id },
          },
          mapPoint,
        });
      });
      if (mapPoints.length) {
        mapStore.mapPoints = [
          createMapPointFromLocation(currentLocation.value),
          ...mapPoints,
        ];
      }
      else {
        mapStore.mapPoints = [
          createMapPointFromLocation(currentLocation.value),
        ];
      }
      sidebarStore.sidebarItems = sidebarItems;
    }
    else if (
      currentLocationLog.value
      && CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")
    ) {
      mapStore.mapPoints = [
        createMapPointFromLocationLog(
          currentLocationLog.value,
          currentLocation.value?.slug || "",
        ),
      ];
      sidebarStore.sidebarItems = [];
    }

    sidebarStore.loading
      = locationsStatus.value === "pending"
        || currentLocationStatus.value === "pending";

    if (sidebarStore.loading) {
      mapStore.mapPoints = [];
    }
  });

  return {
    locations,
    locationsStatus,
    locationsRefresh,
    currentLocation,
    currentLocationStatus,
    currentLocationError,
    currentLocationRefresh,
    currentLocationLog,
    currentLocationLogStatus,
    currentLocationLogError,
    currentLocationLogRefresh,
  };
});

export function isPointSelected(
  item: Pick<MapPoint, "id" | "lat" | "long"> | null | undefined,
  selectedPoint: MapPoint | null | undefined,
) {
  return (
    selectedPoint
    && item
    && selectedPoint.id === item.id
    && selectedPoint.lat === item.lat
    && selectedPoint.long === item.long
  );
}

export function createMapPointFromLocation(location: SelectLocation): MapPoint {
  return {
    ...location,
    to: { name: "dashboard-location-slug", params: { slug: location.slug } },
    toLabel: "View",
  };
}

export function createMapPointFromLocationLog(
  locationLog: SelectLocationLog,
  slug: string,
): MapPoint {
  return {
    ...locationLog,
    to: {
      name: "dashboard-location-slug-id",
      params: { slug, id: locationLog.id },
    },
    toLabel: "View",
    slug,
  };
}
