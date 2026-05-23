import { z } from "zod";

import { findOrCreateLocationForRoutePoint } from "~/lib/db/queries/location";
import { insertLocationLog } from "~/lib/db/queries/location-log";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const CreatePrivatePlacePhotoSchema = z.object({
  placeName: z.string().trim().min(1).max(100),
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
  locationAccuracy: z.number().min(0).max(50000).nullable().optional(),
  locationSource: z.enum(["gps", "approximate", "manual"]),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, CreatePrivatePlacePhotoSchema.safeParse);
  if (!body.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Некорректный запрос фото места",
    }));
  }

  const now = Date.now();
  const location = await findOrCreateLocationForRoutePoint(event.context.user.id, {
    name: body.data.placeName,
    description: null,
    lat: body.data.lat,
    long: body.data.long,
  });

  const locationLog = await insertLocationLog({
    name: body.data.placeName,
    description: null,
    startedAt: now,
    endedAt: now,
    lat: body.data.lat,
    long: body.data.long,
  }, location.id, event.context.user.id);

  return {
    location,
    locationLog,
    locationAccuracy: body.data.locationAccuracy ?? null,
    locationSource: body.data.locationSource,
    upload: {
      signUrl: `/api/locations/${location.slug}/${locationLog.id}/sign-images`,
      imageUrl: `/api/locations/${location.slug}/${locationLog.id}/image`,
    },
  };
});
