import { nanoid } from "nanoid";

import type { ExploreAnchorPoint, ExploreCandidatePlace } from "~/lib/explore/context";
import type { RouteMapPoint } from "~/lib/explore/route-map";
import type { SelectedExploreCity } from "~/lib/explore/search";

export type UserRoutePoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day: number;
};

// Module-level state so the map page, the placement control, and the Mapbox
// click handler all read and mutate the same list of manually dropped stops.
const userPoints = ref<UserRoutePoint[]>([]);
const isAddMode = ref(false);

function addUserPoint(input: { lat: number; lng: number; day: number; name?: string }) {
  const id = nanoid(8);
  const name = input.name?.trim() || `Моя точка ${userPoints.value.length + 1}`;

  userPoints.value = [
    ...userPoints.value,
    { id, name, lat: input.lat, lng: input.lng, day: input.day },
  ];

  return id;
}

function removeUserPoint(id: string) {
  userPoints.value = userPoints.value.filter(point => point.id !== id);
}

function clearUserPoints() {
  userPoints.value = [];
}

function setAddMode(enabled: boolean) {
  isAddMode.value = enabled;
}

function toggleAddMode() {
  isAddMode.value = !isAddMode.value;
}

function toUserRouteMapPoint(point: UserRoutePoint, index = 0): RouteMapPoint {
  return {
    id: `user-place-${point.id}`,
    sourceId: point.id,
    markerKind: "user-place",
    sequence: index,
    day: point.day,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
  };
}

// Shapes a manual stop as a selected candidate place so the AI route generator
// treats it as a place to weave into the route.
function toExploreCandidatePlace(point: UserRoutePoint): ExploreCandidatePlace {
  return {
    id: `user-place-${point.id}`,
    name: point.name,
    coordinates: { lat: point.lat, long: point.lng },
    categories: [],
    source: "fallback",
    selected: true,
  };
}

// Shapes a manual stop as an anchor point: the AI must route through it and then
// enrich the path with additional on-the-way places, instead of merely treating
// it as one more optional candidate.
function toAnchorPoint(point: UserRoutePoint): ExploreAnchorPoint {
  return {
    id: point.id,
    name: point.name,
    coordinates: { lat: point.lat, long: point.lng },
    day: point.day,
  };
}

// Synthesises a region anchor from the centroid of the placed points so the AI
// can generate a route from them even when no city has been chosen.
function buildAnchorCity(): SelectedExploreCity | null {
  const points = userPoints.value;
  if (!points.length)
    return null;

  const lat = points.reduce((total, point) => total + point.lat, 0) / points.length;
  const long = points.reduce((total, point) => total + point.lng, 0) / points.length;
  const id = `manual-${lat.toFixed(4)}-${long.toFixed(4)}`;

  return {
    id,
    provider: "nominatim",
    providerId: id,
    label: "Мои точки",
    name: "Мои точки",
    coordinates: { lat, long },
    source: "fallback",
  };
}

export function useUserRoutePoints() {
  return {
    userPoints,
    isAddMode,
    addUserPoint,
    removeUserPoint,
    clearUserPoints,
    setAddMode,
    toggleAddMode,
    toUserRouteMapPoint,
    toExploreCandidatePlace,
    toAnchorPoint,
    buildAnchorCity,
  };
}
