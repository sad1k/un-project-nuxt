import { z } from "zod";

import { getPostById } from "~/lib/db/queries/post";
import { createComment, getCommentById } from "~/lib/db/queries/post-comment";
import { dispatchPush } from "~/lib/notifications/dispatch";
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

  const postId = Number(id);
  const comment = await createComment(
    postId,
    event.context.user.id,
    content,
    parentId,
    replyToUserId,
  );

  // Push: reply notifies the parent comment's author; otherwise notify post author
  if (replyToUserId && replyToUserId !== event.context.user.id) {
    void dispatchPush({
      userId: replyToUserId,
      type: "social.reply",
      payload: {
        title: "Ответ на ваш комментарий",
        body: `${event.context.user.name ?? "Кто-то"}: ${content.slice(0, 120)}`,
        url: `/feed?postId=${postId}`,
      },
      digestKey: `post-${postId}-reply-${replyToUserId}`,
    });
  }
  else {
    const post = await getPostById(postId);
    if (post && post.userId !== event.context.user.id) {
      void dispatchPush({
        userId: post.userId,
        type: "social.comment",
        payload: {
          title: "Новый комментарий",
          body: `${event.context.user.name ?? "Кто-то"}: ${content.slice(0, 120)}`,
          url: `/feed?postId=${postId}`,
        },
        digestKey: `post-${postId}-comment`,
      });
    }
  }

  await recordIdempotentResponse(event, 200, comment);
  return comment;
});
