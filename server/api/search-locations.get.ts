import type { SearchLocation } from "~/lib/types";

import { SearchLocationQuery } from "~/lib/db/schema/search-location";
import { getExploreSearchCacheKey, normalizeExploreQuery } from "~/lib/explore/search";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(defineCachedFunction(async (event) => {
  const { q } = await getValidatedQuery(event, SearchLocationQuery.parse);
  const normalizedQuery = normalizeExploreQuery(q);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    const params = new URLSearchParams({
      addressdetails: "1",
      format: "json",
      limit: "8",
      q: normalizedQuery,
    });
    url.search = params.toString();

    const response = await fetch(url, {
      headers: { "User-Agent": "WanderLog Explore Search" },
    });

    if (!response.ok) {
      return sendError(event, createError({
        statusCode: 504,
        statusMessage: "Location search provider unavailable",
      }));
    }

    const data = await response.json() as SearchLocation[];

    return data;
  }
  catch (e) {
    return sendError(event, createError({
      data: e instanceof Error ? { message: e.message } : undefined,
      statusCode: 504,
      statusMessage: "Location search provider unavailable",
    }));
  }
}, {
  maxAge: 60 * 60 * 24,
  getKey: (event) => {
    const query = getQuery(event);
    return getExploreSearchCacheKey(query.q?.toString() || "");
  },
  name: "search-locations",
}));
