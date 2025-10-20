import type { SearchLocation } from "~/lib/types";

import { SearchLocationQuery } from "~/lib/db/schema/search-location";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(defineCachedFunction(async (event) => {
  const { q } = await getValidatedQuery(event, SearchLocationQuery.parse);

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?=${q}&format=json`, {
      headers: { "User-Agent": "test-project | misha.kirillov.0990@gmail.com" },
    });

    if (!response.ok) {
      return sendError(event, createError({
        statusCode: 504,
        message: "Произошла ошибка в запросе API",
      }));
    }

    const data = await response.json() as SearchLocation[];

    return data;
  }
  catch (e) {
    return sendError(event, createError({
      data: e,
      statusCode: 504,
      message: "Произошла ошибка в запросе API",
    }));
  }
}, {
  maxAge: 60 * 60 * 24,
  getKey: (event) => {
    const query = getQuery(event);
    return query.q?.toString() || "";
  },
  name: "search-locations",
}));
