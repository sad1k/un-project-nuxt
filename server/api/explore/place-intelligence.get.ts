import { z } from "zod";

import type { PlaceMediaResolutionResult } from "~/lib/explore/place-media";

import { findAiRoutePointForPlaceIntelligence } from "~/lib/db/queries/ai-route";
import { findCommunityPlaceSignal } from "~/lib/db/queries/place-intelligence";
import env from "~/lib/env";
import { buildPlaceIntelligence, createUnavailablePlaceIntelligence } from "~/lib/explore/place-intelligence";
import { fetchPlaceIntelligence, fetchTripAdvisorPlaceReviews } from "~/lib/explore/place-intelligence-providers";
import { resolveRealPlacePhoto, toPlacePhoto } from "~/lib/explore/place-media";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  variantId: z.coerce.number().int().positive().optional(),
  routePointId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(160),
  day: z.coerce.number().int().min(1).max(14).optional(),
  lat: z.coerce.number().min(-90).max(90),
  long: z.coerce.number().min(-180).max(180),
  // The progressive popup resolves the (slow) photo via a separate parallel request, so it
  // passes withPhoto=0 to get the fast intelligence payload first. Default = include the photo
  // (the bottom-sheet path that wants the full object in one call).
  withPhoto: z.coerce.number().int().optional(),
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

  // Deferred-photo sentinel: when withPhoto=0 the popup resolves the photo via the separate
  // place-photo-resolve request, so we skip the slow provider chain here and report no photo.
  const includePhoto = query.withPhoto !== 0;
  const deferredPhoto: PlaceMediaResolutionResult = {
    status: "missing",
    reason: "provider_no_match",
    source: { kind: "missing", label: "Фото загружается отдельно", confidence: "low" },
  };

  const [providerResult, community, resolvedPhoto] = await Promise.all([
    fetchPlaceIntelligence({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }, { withReviews: includePhoto }),
    findCommunityPlaceSignal({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }),
    includePhoto
      ? resolveRealPlacePhoto({
          name: basePlace.name,
          lat: basePlace.coordinates.lat,
          long: basePlace.coordinates.long,
        })
      : Promise.resolve(deferredPhoto),
  ]);

  // Free provider-native reviews (2GIS or Google) first; pay for the billable TripAdvisor
  // endpoint only when explicitly enabled AND the provider returned none — and only on the
  // full panel/sheet call.
  let reviews = providerResult.data?.reviews ?? [];
  if (includePhoto && reviews.length === 0 && env.TRIPADVISOR_REVIEWS_ENABLED) {
    reviews = await fetchTripAdvisorPlaceReviews({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    });
  }

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
      reviews,
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
