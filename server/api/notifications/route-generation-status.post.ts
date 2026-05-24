import { z } from "zod";

import { markAiRouteNotificationStatus } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const RouteNotificationStatusSchema = z.object({
  sessionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  notificationStatus: z.enum(["pending", "delivered", "failed", "dismissed"]),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, RouteNotificationStatusSchema.parse);
  const variant = await markAiRouteNotificationStatus(event.context.user.id, body);

  if (!variant) {
    throw createError({
      statusCode: 404,
      statusMessage: "Вариант маршрута не найден",
    });
  }

  return {
    ok: true,
  };
});
