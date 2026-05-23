import { z } from "zod";

import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const NearbyPlacesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).max(50000).optional(),
});

type NearbyPlace = {
  id: string;
  name: string;
  description?: string;
  lat: number;
  long: number;
  source: "provider" | "fallback";
};

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, NearbyPlacesQuerySchema.safeParse);
  if (!query.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Некорректные координаты",
    }));
  }

  const fallbackPlace = createFallbackPlace(query.data.lat, query.data.long);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({
      addressdetails: "1",
      format: "json",
      lat: query.data.lat.toString(),
      lon: query.data.long.toString(),
      zoom: "18",
    }).toString();

    const response = await fetch(url, {
      headers: { "User-Agent": "WanderLog Place Photo Capture" },
    });

    if (!response.ok) {
      return { places: [fallbackPlace] };
    }

    const providerPlace = normalizeNominatimPlace(await response.json(), query.data.lat, query.data.long);
    return {
      places: providerPlace ? [providerPlace, fallbackPlace] : [fallbackPlace],
    };
  }
  catch {
    return { places: [fallbackPlace] };
  }
});

function normalizeNominatimPlace(input: unknown, lat: number, long: number): NearbyPlace | null {
  if (!isRecord(input))
    return null;

  const displayName = typeof input.display_name === "string" ? input.display_name : "";
  if (!displayName)
    return null;

  const address = isRecord(input.address) ? input.address : {};
  const primaryName = pickName(address) ?? displayName.split(",")[0]?.trim();
  if (!primaryName)
    return null;

  return {
    id: `nominatim:${typeof input.place_id === "number" ? input.place_id : `${lat},${long}`}`,
    name: primaryName,
    description: displayName,
    lat,
    long,
    source: "provider",
  };
}

function pickName(address: Record<string, unknown>) {
  for (const key of ["attraction", "tourism", "amenity", "building", "road", "suburb", "city"]) {
    const value = address[key];
    if (typeof value === "string" && value.trim())
      return value.trim();
  }

  return null;
}

function createFallbackPlace(lat: number, long: number): NearbyPlace {
  return {
    id: `gps:${lat.toFixed(5)},${long.toFixed(5)}`,
    name: `Место фото ${lat.toFixed(5)}, ${long.toFixed(5)}`,
    description: "GPS-метка подтверждена на карте",
    lat,
    long,
    source: "fallback",
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
