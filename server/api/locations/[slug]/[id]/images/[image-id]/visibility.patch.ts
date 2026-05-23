import { z } from "zod";

import {
  makeLocationLogImagePrivate,
  makeLocationLogImagePublic,
} from "~/lib/db/queries/location-log-image";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const LocationSourceSchema = z.enum(["gps", "approximate", "manual"]);

const VisibilityPatchSchema = z.discriminatedUnion("visibility", [
  z.object({
    visibility: z.literal("public"),
    publicPlaceName: z.string().trim().min(1).max(240),
    publicLat: z.number().min(-90).max(90),
    publicLong: z.number().min(-180).max(180),
    locationAccuracy: z.number().min(0).max(50000).nullable().optional(),
    locationSource: LocationSourceSchema.nullable().optional(),
  }),
  z.object({
    visibility: z.literal("private"),
  }),
]);

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;
  const id = getRouterParam(event, "id") as string;
  const imageId = getRouterParam(event, "image-id") as string;

  const logIdResult = z.coerce.number().int().positive().safeParse(id);
  const imageIdResult = z.coerce.number().int().positive().safeParse(imageId);
  if (!logIdResult.success || !imageIdResult.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Некорректный ID",
    }));
  }

  const body = await readValidatedBody(event, VisibilityPatchSchema.safeParse);
  if (!body.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Некорректный запрос видимости",
    }));
  }

  await event.$fetch(`/api/locations/${slug}/${logIdResult.data}`);

  const updatedImage = body.data.visibility === "public"
    ? await makeLocationLogImagePublic(imageIdResult.data, event.context.user.id, {
        publicPlaceName: body.data.publicPlaceName,
        publicLat: body.data.publicLat,
        publicLong: body.data.publicLong,
        locationAccuracy: body.data.locationAccuracy,
        locationSource: body.data.locationSource,
      })
    : await makeLocationLogImagePrivate(imageIdResult.data, event.context.user.id);

  if (!updatedImage) {
    return sendError(event, createError({
      statusCode: 404,
      statusMessage: "Изображение не найдено",
    }));
  }

  return updatedImage;
});
