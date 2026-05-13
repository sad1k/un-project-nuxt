export const MIN_CITY_QUERY_LENGTH = 2;
export const DEFAULT_CITY_SUGGESTION_LIMIT = 6;

export type ExploreSearchProvider = "mapbox" | "nominatim";

export type ExploreCoordinates = {
  lat: number;
  long: number;
};

export type ExploreCitySuggestion = {
  id: string;
  provider: ExploreSearchProvider;
  providerId: string;
  label: string;
  name: string;
  description?: string;
  coordinates?: ExploreCoordinates;
  bbox?: [number, number, number, number];
  source?: "provider" | "fallback";
};

export type SelectedExploreCity = ExploreCitySuggestion & {
  coordinates: ExploreCoordinates;
};

export type NominatimSearchResult = {
  place_id: number | string;
  lat: string | number;
  lon: string | number;
  display_name: string;
  boundingbox?: Array<string | number>;
  type?: string;
  class?: string;
};

type MapboxSuggestion = {
  mapbox_id?: string;
  id?: string;
  name?: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  bbox?: [number, number, number, number];
  context?: {
    place?: { name?: string };
    region?: { name?: string };
    country?: { name?: string };
  };
};

type MapboxFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: MapboxSuggestion;
  bbox?: [number, number, number, number];
};

export function normalizeExploreQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export function getExploreSearchCacheKey(query: string) {
  return normalizeExploreQuery(query).toLocaleLowerCase();
}

export function isUsefulCityQuery(query: string) {
  return normalizeExploreQuery(query).length >= MIN_CITY_QUERY_LENGTH;
}

export function normalizeMapboxSuggestions(input: unknown): ExploreCitySuggestion[] {
  const suggestions = isRecord(input) && Array.isArray(input.suggestions)
    ? input.suggestions
    : [];

  return suggestions
    .map(normalizeMapboxSuggestion)
    .filter((suggestion): suggestion is ExploreCitySuggestion => Boolean(suggestion));
}

export function normalizeMapboxSuggestion(input: unknown): ExploreCitySuggestion | null {
  if (!isRecord(input))
    return null;

  const suggestion = input as MapboxSuggestion;
  const providerId = suggestion.mapbox_id || suggestion.id;
  const name = suggestion.name;

  if (!providerId || !name)
    return null;

  const coordinates = normalizeMapboxCoordinates(suggestion);
  const description = suggestion.full_address || suggestion.place_formatted || formatMapboxContext(suggestion);

  return {
    id: `mapbox:${providerId}`,
    provider: "mapbox",
    providerId,
    label: description ? `${name}, ${description}` : name,
    name,
    description,
    coordinates,
    bbox: suggestion.bbox,
    source: "provider",
  };
}

export function normalizeMapboxFeature(input: unknown): SelectedExploreCity | null {
  if (!isRecord(input))
    return null;

  const feature = input as MapboxFeature;
  const suggestion = normalizeMapboxSuggestion(feature.properties);
  const coordinates = normalizeLngLat(feature.geometry?.coordinates) || suggestion?.coordinates;

  if (!suggestion || !coordinates)
    return null;

  return {
    ...suggestion,
    coordinates,
    bbox: feature.bbox || suggestion.bbox,
  };
}

export function normalizeNominatimResults(input: unknown): ExploreCitySuggestion[] {
  if (!Array.isArray(input))
    return [];

  return input
    .map(normalizeNominatimResult)
    .filter((suggestion): suggestion is ExploreCitySuggestion => Boolean(suggestion));
}

export function normalizeNominatimResult(input: unknown): ExploreCitySuggestion | null {
  if (!isRecord(input))
    return null;

  const result = input as NominatimSearchResult;
  const providerId = String(result.place_id || "");
  const name = extractNominatimName(result.display_name);
  const coordinates = normalizeLatLong(result.lat, result.lon);

  if (!providerId || !name || !coordinates)
    return null;

  return {
    id: `nominatim:${providerId}`,
    provider: "nominatim",
    providerId,
    label: result.display_name,
    name,
    description: result.display_name,
    coordinates,
    bbox: normalizeNominatimBbox(result.boundingbox),
    source: "fallback",
  };
}

export function toSelectedExploreCity(suggestion: ExploreCitySuggestion): SelectedExploreCity | null {
  if (!suggestion.coordinates)
    return null;

  return {
    ...suggestion,
    coordinates: suggestion.coordinates,
  };
}

function normalizeMapboxCoordinates(suggestion: MapboxSuggestion) {
  const latitude = suggestion.coordinates?.latitude;
  const longitude = suggestion.coordinates?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number")
    return undefined;

  return { lat: latitude, long: longitude };
}

function normalizeLngLat(coordinates: [number, number] | undefined) {
  if (!coordinates)
    return undefined;

  const [long, lat] = coordinates;
  if (typeof lat !== "number" || typeof long !== "number")
    return undefined;

  return { lat, long };
}

function normalizeLatLong(latValue: string | number, longValue: string | number) {
  const lat = typeof latValue === "number" ? latValue : Number.parseFloat(latValue);
  const long = typeof longValue === "number" ? longValue : Number.parseFloat(longValue);

  if (!Number.isFinite(lat) || !Number.isFinite(long))
    return null;

  return { lat, long };
}

function normalizeNominatimBbox(boundingbox: Array<string | number> | undefined) {
  if (!boundingbox || boundingbox.length < 4)
    return undefined;

  const [south, north, west, east] = boundingbox.map(value => typeof value === "number" ? value : Number.parseFloat(value));
  if (![south, north, west, east].every(Number.isFinite))
    return undefined;

  return [west, south, east, north] as [number, number, number, number];
}

function extractNominatimName(displayName: string | undefined) {
  return displayName?.split(",")[0]?.trim() || "";
}

function formatMapboxContext(suggestion: MapboxSuggestion) {
  return [
    suggestion.context?.place?.name,
    suggestion.context?.region?.name,
    suggestion.context?.country?.name,
  ]
    .filter(Boolean)
    .join(", ") || undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
