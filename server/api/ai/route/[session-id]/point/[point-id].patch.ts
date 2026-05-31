import { z } from "zod";

import { RoutePointPatchSchema } from "~/lib/ai/route-contract";
import { updateAiRoutePoint } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const BodySchema = z.object({
  variantId: z.number().int().positive(),
  patch: RoutePointPatchSchema,
});

export default defineAuthenticatedHandler(async (event) => {
  parsePositiveId(getRouterParam(event, "session-id"), "сессии");
  const routePointId = parseRoutePointId(getRouterParam(event, "point-id"));

  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос правки точки" });
  }

  const updated = await updateAiRoutePoint(event.context.user.id, {
    variantId: body.data.variantId,
    routePointId,
    patch: body.data.patch,
  });

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Точка маршрута не найдена" });
  }

  return { point: updated };
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
