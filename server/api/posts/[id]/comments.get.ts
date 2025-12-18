import { z } from "zod";

import { getCommentsByPostId } from "~/lib/db/queries/post-comment";

export default defineEventHandler(async (event) => {
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

  return getCommentsByPostId(Number(id));
});
