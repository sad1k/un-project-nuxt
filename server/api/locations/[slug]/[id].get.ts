import { z } from "zod";

import { findLocationBySlug, findLocationLogById } from "~/lib/db/queries/location";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;
  console.log(slug, "slug");
  const location = await findLocationBySlug(event.context.user.id, slug);
  if (!location) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Место не найдено",
      }),
    );
  }

  const id = getRouterParam(event, "id") as string;

  if (!z.coerce.number().safeParse(id).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID",
      }),
    );
  }

  const locationLog = await findLocationLogById(Number(id), event.context.user.id);
  if (!locationLog) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Лог не найден",
      }),
    );
  }
  return locationLog;
});
