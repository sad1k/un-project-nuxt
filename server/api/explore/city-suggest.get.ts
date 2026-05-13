import { z } from "zod";

import type { ExploreCitySuggestion } from "~/lib/explore/search";

import {
  DEFAULT_CITY_SUGGESTION_LIMIT,
  getExploreSearchCacheKey,
  isUsefulCityQuery,
  normalizeExploreQuery,
  normalizeMapboxSuggestions,
  normalizeNominatimResults,
} from "~/lib/explore/search";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  sessionToken: z.string().trim().min(8).max(128).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const { q, sessionToken } = await getValidatedQuery(event, QuerySchema.parse);
  const query = normalizeExploreQuery(q);

  if (!isUsefulCityQuery(query))
    return [];

  const mapboxToken = getMapboxToken(event);

  if (mapboxToken) {
    const mapboxSuggestions = await fetchMapboxSuggestions(query, sessionToken, mapboxToken);
    if (mapboxSuggestions.length > 0)
      return mapboxSuggestions;
  }

  return fetchNominatimSuggestions(query);
});

async function fetchMapboxSuggestions(query: string, sessionToken: string | undefined, accessToken: string): Promise<ExploreCitySuggestion[]> {
  try {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
    const params = new URLSearchParams({
      access_token: accessToken,
      language: "en",
      limit: DEFAULT_CITY_SUGGESTION_LIMIT.toString(),
      q: query,
      types: "place,locality",
    });

    if (sessionToken)
      params.set("session_token", sessionToken);

    url.search = params.toString();

    const response = await fetch(url);
    if (!response.ok)
      return [];

    return normalizeMapboxSuggestions(await response.json());
  }
  catch {
    return [];
  }
}

async function fetchNominatimSuggestions(query: string): Promise<ExploreCitySuggestion[]> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    const params = new URLSearchParams({
      addressdetails: "1",
      featureType: "city",
      format: "json",
      limit: DEFAULT_CITY_SUGGESTION_LIMIT.toString(),
      q: query,
    });
    url.search = params.toString();

    const response = await fetch(url, {
      headers: { "User-Agent": "WanderLog Explore Search" },
    });

    if (!response.ok)
      throw createError({ statusCode: 504, statusMessage: "Location search provider unavailable" });

    return normalizeNominatimResults(await response.json());
  }
  catch {
    throw createError({ statusCode: 504, statusMessage: "Location search provider unavailable" });
  }
}

function getMapboxToken(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event);
  return typeof config.public.mapboxToken === "string" ? config.public.mapboxToken : "";
}

export function getCitySuggestCacheKey(query: string) {
  return getExploreSearchCacheKey(query);
}
