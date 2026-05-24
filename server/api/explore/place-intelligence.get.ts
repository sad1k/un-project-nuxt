import { z } from "zod";

import { findAiRoutePointForPlaceIntelligence } from "~/lib/db/queries/ai-route";
import { findCommunityPlaceSignal } from "~/lib/db/queries/place-intelligence";
import { buildPlaceIntelligence, createUnavailablePlaceIntelligence } from "~/lib/explore/place-intelligence";
import { fetchGooglePlaceIntelligence } from "~/lib/explore/place-intelligence-providers";
import { resolveRealPlacePhoto, toPlacePhoto } from "~/lib/explore/place-media";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  variantId: z.coerce.number().int().positive().optional(),
  routePointId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(160),
  day: z.coerce.number().int().min(1).max(14).optional(),
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
});

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);
  const routePoint = query.variantId && query.routePointId
    ? await findAiRoutePointForPlaceIntelligence(event.context.user.id, {
        variantId: query.variantId,
        routePointId: query.routePointId,
      })
    : null;

  if (query.variantId && query.routePointId && !routePoint) {
    throw createError({
      statusCode: 404,
      statusMessage: "Точка маршрута не найдена",
    });
  }

  const basePlace = {
    id: query.routePointId || `${query.name}:${query.lat}:${query.long}`,
    name: routePoint?.name || query.name,
    day: routePoint?.day || query.day,
    coordinates: {
      lat: routePoint?.lat ?? query.lat,
      long: routePoint?.long ?? query.long,
    },
    rationale: routePoint?.rationale,
  };

  const [providerResult, community, resolvedPhoto] = await Promise.all([
    fetchGooglePlaceIntelligence({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }),
    findCommunityPlaceSignal({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }),
    resolveRealPlacePhoto({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }),
  ]);

  if (!providerResult.available && !routePoint && !community) {
    return createUnavailablePlaceIntelligence(basePlace);
  }

  return buildPlaceIntelligence({
    id: basePlace.id,
    name: basePlace.name,
    day: basePlace.day,
    coordinates: basePlace.coordinates,
    route: routePoint
      ? {
          rationale: routePoint.rationale,
          estimatedPriceLevel: parseRoutePriceLevel(routePoint.estimatedPriceLevel),
          priceConfidence: parseConfidence(routePoint.priceConfidence),
          priceSource: routePoint.priceSource ?? undefined,
        }
      : {
          rationale: basePlace.rationale,
        },
    provider: {
      ...(providerResult.data ?? {}),
      photo: resolvedPhoto.status === "photo" ? toPlacePhoto(resolvedPhoto.photo, basePlace.name) : null,
    },
    community,
  });
});

function parseConfidence(value: string | null | undefined) {
  if (value === "low" || value === "medium" || value === "high")
    return value;

  return undefined;
}

function parseRoutePriceLevel(value: string | null | undefined) {
  if (value === "free" || value === "low" || value === "medium" || value === "high" || value === "unknown")
    return value;

  return undefined;
}
