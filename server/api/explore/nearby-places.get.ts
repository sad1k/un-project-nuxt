import { z } from "zod";

import type { ExploreInterest } from "~/lib/explore/context";
import type { ExploreNearbyPlace, ExploreNearbyResponse } from "~/lib/explore/nearby";
import type { ExploreCoordinates } from "~/lib/explore/search";

import {
  dedupeNearbyPlaces,
  isExploreInterest,
  NEARBY_INTEREST_QUERIES,
  normalizeMapboxNearbyFeature,
} from "~/lib/explore/nearby";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
  interests: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(24).optional(),
});

const DEFAULT_INTERESTS: ExploreInterest[] = ["culture", "food", "nature"];
const MAX_INTEREST_QUERIES = 4;
const RESULTS_PER_INTEREST = 6;
const DEFAULT_RESULT_LIMIT = 16;

export default defineAuthenticatedHandler(async (event): Promise<ExploreNearbyResponse> => {
  const query = await getValidatedQuery(event, QuerySchema.parse);
  const interests = parseInterests(query.interests);
  const origin: ExploreCoordinates = { lat: query.lat, long: query.long };
  const mapboxToken = getMapboxToken(event);

  // Nearby places must carry coordinates to land on the map, so without a
  // proximity-capable provider there is nothing meaningful to return.
  if (!mapboxToken)
    return { places: [] };

  const collected = await Promise.all(
    interests.slice(0, MAX_INTEREST_QUERIES).map(interest =>
      fetchNearbyForInterest({ accessToken: mapboxToken, interest, origin })),
  );

  const places = dedupeNearbyPlaces(collected.flat())
    .sort((first, second) => (first.distanceMeters ?? Number.POSITIVE_INFINITY) - (second.distanceMeters ?? Number.POSITIVE_INFINITY))
    .slice(0, query.limit ?? DEFAULT_RESULT_LIMIT);

  return { places };
});

async function fetchNearbyForInterest(input: {
  accessToken: string;
  interest: ExploreInterest;
  origin: ExploreCoordinates;
}): Promise<ExploreNearbyPlace[]> {
  try {
    const url = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    url.search = new URLSearchParams({
      access_token: input.accessToken,
      language: "ru",
      limit: RESULTS_PER_INTEREST.toString(),
      proximity: `${input.origin.long},${input.origin.lat}`,
      q: NEARBY_INTEREST_QUERIES[input.interest],
      types: "poi",
    }).toString();

    const response = await fetch(url);
    if (!response.ok)
      return [];

    const payload = await response.json();
    const features = isRecord(payload) && Array.isArray(payload.features) ? payload.features : [];

    return features
      .map(feature => normalizeMapboxNearbyFeature(feature, input.interest, input.origin))
      .filter((place): place is ExploreNearbyPlace => Boolean(place));
  }
  catch {
    return [];
  }
}

function parseInterests(value: string | undefined): ExploreInterest[] {
  const interests = value
    ?.split(",")
    .map(entry => entry.trim())
    .filter((entry): entry is ExploreInterest => isExploreInterest(entry));

  return interests?.length ? interests : DEFAULT_INTERESTS;
}

function getMapboxToken(event: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event);
  return typeof config.public.mapboxToken === "string" ? config.public.mapboxToken : "";
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
