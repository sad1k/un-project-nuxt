import { z } from "zod";

import { likePost } from "~/lib/db/queries/post-like";
import { recordIdempotentResponse } from "~/server/middleware/idempotency";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!z.coerce.number().safeParse(id).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID",
      }),
    );
  }

  await likePost(Number(id), event.context.user.id);

  const result = { success: true, liked: true };
  await recordIdempotentResponse(event, 200, result);
  return result;
});
