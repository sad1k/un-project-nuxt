import type { ExploreInterest } from "./context";
import type { ExploreCoordinates } from "./search";

import { haversineDistanceMeters } from "./route-map";

// A real point of interest discovered around the user's location marker. Unlike
// a candidate place (a city-anchored idea without coordinates), a nearby place
// always carries coordinates so it can be drawn on the map and added as a stop.
export type ExploreNearbyPlace = {
  id: string;
  name: string;
  category: ExploreInterest;
  categoryLabel: string;
  coordinates: ExploreCoordinates;
  address?: string;
  distanceMeters?: number;
};

export type ExploreNearbyResponse = {
  places: ExploreNearbyPlace[];
};

export const NEARBY_INTEREST_LABELS: Record<ExploreInterest, string> = {
  "adventure": "Развлечения",
  "art": "Искусство",
  "culture": "Культура",
  "family": "Семейные места",
  "food": "Еда",
  "hidden-gems": "Скрытые места",
  "nature": "Природа",
  "nightlife": "Ночная жизнь",
  "shopping": "Шопинг",
};

// Concrete POI search terms per interest — Mapbox forward search resolves these
// to real points around the proximity coordinate.
export const NEARBY_INTEREST_QUERIES: Record<ExploreInterest, string> = {
  "adventure": "развлечения",
  "art": "галерея",
  "culture": "музей",
  "family": "парк развлечений",
  "food": "ресторан",
  "hidden-gems": "достопримечательности",
  "nature": "парк",
  "nightlife": "бар",
  "shopping": "магазин",
};

export function isExploreInterest(value: string): value is ExploreInterest {
  return Object.prototype.hasOwnProperty.call(NEARBY_INTEREST_QUERIES, value);
}

type MapboxNearbyFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    mapbox_id?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
};

export function normalizeMapboxNearbyFeature(
  input: unknown,
  interest: ExploreInterest,
  origin: ExploreCoordinates,
): ExploreNearbyPlace | null {
  if (!isRecord(input))
    return null;

  const feature = input as MapboxNearbyFeature;
  const properties = feature.properties;
  const name = properties?.name?.trim();
  const coordinates = readFeatureCoordinates(feature);
  if (!name || !coordinates)
    return null;

  const providerId = properties?.mapbox_id || `${coordinates.lat},${coordinates.long}`;

  return {
    id: `mapbox:${providerId}`,
    name,
    category: interest,
    categoryLabel: NEARBY_INTEREST_LABELS[interest],
    coordinates,
    address: properties?.full_address || properties?.place_formatted || undefined,
    distanceMeters: Math.round(haversineDistanceMeters(
      { lat: origin.lat, lng: origin.long },
      { lat: coordinates.lat, lng: coordinates.long },
    )),
  };
}

// The same physical place can surface under more than one interest query, so
// drop repeats by provider id and by a name+coordinate signature.
export function dedupeNearbyPlaces(places: ExploreNearbyPlace[]): ExploreNearbyPlace[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const signature = `${place.name.toLowerCase()}:${place.coordinates.lat.toFixed(4)}:${place.coordinates.long.toFixed(4)}`;
    if (seen.has(place.id) || seen.has(signature))
      return false;

    seen.add(place.id);
    seen.add(signature);
    return true;
  });
}

function readFeatureCoordinates(feature: MapboxNearbyFeature): ExploreCoordinates | null {
  const geometry = feature.geometry?.coordinates;
  if (Array.isArray(geometry) && typeof geometry[0] === "number" && typeof geometry[1] === "number")
    return { lat: geometry[1], long: geometry[0] };

  const properties = feature.properties?.coordinates;
  if (properties && typeof properties.latitude === "number" && typeof properties.longitude === "number")
    return { lat: properties.latitude, long: properties.longitude };

  return null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
