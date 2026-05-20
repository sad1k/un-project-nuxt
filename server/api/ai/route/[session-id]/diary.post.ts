import { z } from "zod";

import { saveRoutePointToDiary } from "~/lib/db/queries/route-diary-save";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const SaveRoutePointToDiaryBodySchema = z.object({
  routePointId: z.string().min(1).max(120),
  variantId: z.number().int().positive(),
});

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parseSessionId(getRouterParam(event, "session-id"));
  const body = SaveRoutePointToDiaryBodySchema.safeParse(await readBody(event));

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid route diary save request",
    });
  }

  const diarySave = await saveRoutePointToDiary(event.context.user.id, {
    routePointId: body.data.routePointId,
    sessionId,
    variantId: body.data.variantId,
  });

  return { diarySave };
});

function parseSessionId(input: string | undefined) {
  const sessionId = Number(input);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid route session id",
    });
  }

  return sessionId;
}
