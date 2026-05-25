import { z } from "zod";

import { createComment, getCommentById } from "~/lib/db/queries/post-comment";
import { recordIdempotentResponse } from "~/server/middleware/idempotency";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const bodySchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.number().optional(),
  replyToUserId: z.number().optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!z.coerce.number().safeParse(id).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID поста",
      }),
    );
  }

  const body = await readValidatedBody(event, bodySchema.safeParse);

  if (!body.success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: body.error.issues.map(issue => `${issue.path.join("")}: ${issue.message}`).join("; "),
      }),
    );
  }

  const { content, parentId, replyToUserId } = body.data;

  if (parentId) {
    const parent = await getCommentById(parentId);
    if (!parent || parent.postId !== Number(id)) {
      return sendError(
        event,
        createError({
          statusCode: 404,
          statusMessage: "Родительский комментарий не найден",
        }),
      );
    }
  }

  const comment = await createComment(
    Number(id),
    event.context.user.id,
    content,
    parentId,
    replyToUserId,
  );

  await recordIdempotentResponse(event, 200, comment);
  return comment;
});
