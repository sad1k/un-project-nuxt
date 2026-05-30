import { z } from "zod";

import { deleteAiRoutePoint } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  variantId: z.coerce.number().int().positive(),
});

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parsePositiveId(getRouterParam(event, "session-id"), "сессии");
  const routePointId = parseRoutePointId(getRouterParam(event, "point-id"));

  const query = QuerySchema.safeParse(getQuery(event));
  if (!query.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос удаления точки" });
  }

  const deleted = await deleteAiRoutePoint(event.context.user.id, {
    sessionId,
    variantId: query.data.variantId,
    routePointId,
  });

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Точка маршрута не найдена" });
  }

  setResponseStatus(event, 204);
  return null;
});

function parsePositiveId(input: string | undefined, label: string) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Некорректный ID ${label}` });
  }
  return value;
}

function parseRoutePointId(input: string | undefined) {
  const value = input ? decodeURIComponent(input) : "";
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный ID точки" });
  }
  return value;
}
