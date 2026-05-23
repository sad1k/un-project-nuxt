import { z } from "zod";

import { listPublicPlacePhotos } from "~/lib/db/queries/location-log-image";

const BoundsSchema = z.object({
  north: z.coerce.number().min(-90).max(90).optional(),
  south: z.coerce.number().min(-90).max(90).optional(),
  east: z.coerce.number().min(-180).max(180).optional(),
  west: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).superRefine((value, ctx) => {
  const boundsValues = [value.north, value.south, value.east, value.west];
  const hasAnyBound = boundsValues.some(bound => bound !== undefined);
  const hasAllBounds = boundsValues.every(bound => bound !== undefined);

  if (hasAnyBound && !hasAllBounds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
    message: "Для фильтрации публичных фото нужны все границы карты",
      path: ["bounds"],
    });
  }

  if (hasAllBounds && value.south! > value.north!) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
    message: "Южная граница должна быть меньше северной",
      path: ["south"],
    });
  }

  if (hasAllBounds && value.west! > value.east!) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
    message: "Западная граница должна быть меньше восточной",
      path: ["west"],
    });
  }
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, BoundsSchema.safeParse);

  if (!query.success) {
    return sendError(event, createError({
      statusCode: 422,
    statusMessage: "Некорректные границы публичных фото",
    }));
  }

  const { north, south, east, west, limit } = query.data;
  const photos = await listPublicPlacePhotos({
    bounds: north === undefined || south === undefined || east === undefined || west === undefined
      ? undefined
      : { north, south, east, west },
    limit,
  });

  return {
    photos: photos.map(photo => ({
      id: photo.id,
      key: photo.key,
      publicPlaceName: photo.publicPlaceName,
      publicLat: photo.publicLat,
      publicLong: photo.publicLong,
      publishedAt: photo.publishedAt,
      locationAccuracy: photo.locationAccuracy,
      locationSource: photo.locationSource,
      authorName: photo.authorName,
    })),
  };
});
