import { z } from "zod";

import { deleteComment } from "~/lib/db/queries/post-comment";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const commentId = getRouterParam(event, "commentId");

  if (!z.coerce.number().safeParse(commentId).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID комментария",
      }),
    );
  }

  const deleted = await deleteComment(Number(commentId), event.context.user.id);

  if (!deleted) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Комментарий не найден или вы не являетесь его автором",
      }),
    );
  }

  return { success: true };
});
