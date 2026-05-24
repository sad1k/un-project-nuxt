import { z } from "zod";

import type { ExploreCandidatePlace, ExploreInterest } from "~/lib/explore/context";

import { normalizeExploreQuery } from "~/lib/explore/search";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  cityName: z.string().trim().min(1).max(120),
  interests: z.string().trim().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  long: z.coerce.number().min(-180).max(180).optional(),
});

const DEFAULT_INTERESTS: ExploreInterest[] = ["culture", "food", "nature"];

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);
  const interests = parseInterests(query.interests);
  const mapboxToken = getMapboxToken(event);

  if (mapboxToken && query.lat !== undefined && query.long !== undefined) {
    const providerPlaces = await fetchMapboxCandidatePlaces({
      accessToken: mapboxToken,
      cityName: query.cityName,
      interests,
      lat: query.lat,
      long: query.long,
    });

    if (providerPlaces.length)
      return providerPlaces;
  }

  return createFallbackCandidatePlaces(query.cityName, interests);
});

async function fetchMapboxCandidatePlaces(input: {
  accessToken: string;
  cityName: string;
  interests: ExploreInterest[];
  lat: number;
  long: number;
}) {
  const collected = await Promise.all(input.interests.slice(0, 4).map(async (interest) => {
    try {
      const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
      const params = new URLSearchParams({
        access_token: input.accessToken,
        language: "en",
        limit: "3",
        proximity: `${input.long},${input.lat}`,
        q: `${interestLabel(interest)} in ${input.cityName}`,
        types: "poi",
      });
      url.search = params.toString();

      const response = await fetch(url);
      if (!response.ok)
        return [];

      return normalizeMapboxCandidateResponse(await response.json(), interest);
    }
    catch {
      return [];
    }
  }));

  return dedupeCandidatePlaces(collected.flat()).slice(0, 12);
}

function normalizeMapboxCandidateResponse(input: unknown, interest: ExploreInterest): ExploreCandidatePlace[] {
  if (!isRecord(input) || !Array.isArray(input.suggestions))
    return [];

  return input.suggestions
    .map((suggestion): ExploreCandidatePlace | null => {
      if (!isRecord(suggestion))
        return null;

      const providerId = typeof suggestion.mapbox_id === "string" ? suggestion.mapbox_id : undefined;
      const name = typeof suggestion.name === "string" ? suggestion.name : undefined;
      if (!providerId || !name)
        return null;

      return {
        id: `mapbox:${providerId}`,
        provider: "mapbox",
        providerId,
        name,
        description: typeof suggestion.place_formatted === "string" ? suggestion.place_formatted : undefined,
        categories: [interest],
        source: "provider",
        selected: false,
      };
    })
    .filter((place): place is ExploreCandidatePlace => Boolean(place));
}

function createFallbackCandidatePlaces(cityName: string, interests: ExploreInterest[]): ExploreCandidatePlace[] {
  return interests.slice(0, 6).map((interest, index) => ({
    id: `fallback:${normalizeExploreQuery(cityName).toLowerCase()}:${interest}`,
    name: `${interestLabel(interest)} в ${cityName}`,
    description: "Популярная стартовая идея для маршрута",
    categories: [interest],
    source: "fallback",
    selected: index < 3,
  }));
}

function parseInterests(value: string | undefined) {
  const interests = value
    ?.split(",")
    .map(entry => entry.trim())
    .filter((entry): entry is ExploreInterest => isExploreInterest(entry));

  return interests?.length ? interests : DEFAULT_INTERESTS;
}

function dedupeCandidatePlaces(places: ExploreCandidatePlace[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id))
      return false;

    seen.add(place.id);
    return true;
  });
}

function interestLabel(interest: ExploreInterest) {
  const labels: Record<ExploreInterest, string> = {
    "adventure": "Приключения",
    "art": "Искусство",
    "culture": "Культура",
    "family": "Семейные места",
    "food": "Еда",
    "hidden-gems": "Скрытые места",
    "nature": "Природа",
    "nightlife": "Ночная жизнь",
    "shopping": "Шопинг",
  };

  return labels[interest];
}

function isExploreInterest(value: string): value is ExploreInterest {
  return [
    "culture",
    "food",
    "nature",
    "adventure",
    "art",
    "nightlife",
    "shopping",
    "family",
    "hidden-gems",
  ].includes(value);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function getMapboxToken(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event);
  return typeof config.public.mapboxToken === "string" ? config.public.mapboxToken : "";
}
