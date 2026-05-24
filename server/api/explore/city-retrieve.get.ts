import { z } from "zod";

import {
  normalizeMapboxFeature,
  toSelectedExploreCity,
} from "~/lib/explore/search";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  provider: z.enum(["mapbox", "nominatim"]),
  providerId: z.string().trim().min(1).max(256),
  sessionToken: z.string().trim().min(8).max(128).optional(),
  label: z.string().trim().min(1).max(500).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  long: z.coerce.number().min(-180).max(180).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);

  if (query.provider === "nominatim") {
    if (query.lat === undefined || query.long === undefined || !query.name) {
      throw createError({
        statusCode: 422,
        statusMessage: "Для выбора города из резервного источника нужны название и координаты",
      });
    }

    return {
      id: `nominatim:${query.providerId}`,
      provider: "nominatim",
      providerId: query.providerId,
      label: query.label || query.name,
      name: query.name,
      description: query.label,
      coordinates: {
        lat: query.lat,
        long: query.long,
      },
      source: "fallback",
    };
  }

  const mapboxToken = getMapboxToken(event);
  if (!mapboxToken) {
    throw createError({
      statusCode: 503,
      statusMessage: "Получение города из Mapbox не настроено",
    });
  }

  const selectedCity = await retrieveMapboxCity(query.providerId, query.sessionToken, mapboxToken);
  if (!selectedCity) {
    throw createError({
      statusCode: 404,
      statusMessage: "Не удалось получить подсказку города",
    });
  }

  return selectedCity;
});

async function retrieveMapboxCity(providerId: string, sessionToken: string | undefined, accessToken: string) {
  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(providerId)}`);
  const params = new URLSearchParams({
    access_token: accessToken,
  });

  if (sessionToken)
    params.set("session_token", sessionToken);

  url.search = params.toString();

  const response = await fetch(url);
  if (!response.ok)
    return null;

  const body = await response.json();
  const features = Array.isArray(body.features) ? body.features : [];
  return normalizeMapboxFeature(features[0]) || toSelectedExploreCity({
    id: `mapbox:${providerId}`,
    provider: "mapbox",
    providerId,
    label: providerId,
    name: providerId,
    source: "provider",
  });
}

function getMapboxToken(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event);
  return typeof config.public.mapboxToken === "string" ? config.public.mapboxToken : "";
}
