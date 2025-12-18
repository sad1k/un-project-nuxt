import { z } from "zod";

import { deletePost } from "~/lib/db/queries/post";
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

  const deleted = await deletePost(Number(id), event.context.user.id);

  if (!deleted) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Пост не найден или вы не являетесь его автором",
      }),
    );
  }

  return { success: true };
});
