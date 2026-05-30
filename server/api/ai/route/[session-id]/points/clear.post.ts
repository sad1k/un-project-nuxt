import { z } from "zod";

import { clearAiRouteVariantPoints } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const BodySchema = z.object({
  variantId: z.number().int().positive(),
});

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parsePositiveId(getRouterParam(event, "session-id"), "сессии");

  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: "Некорректный запрос очистки точек" });
  }

  const clearedCount = await clearAiRouteVariantPoints(event.context.user.id, {
    sessionId,
    variantId: body.data.variantId,
  });

  return { clearedCount };
});

function parsePositiveId(input: string | undefined, label: string) {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Некорректный ID ${label}` });
  }
  return value;
}
