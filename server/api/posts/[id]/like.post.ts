import { z } from "zod";

import { getPostById } from "~/lib/db/queries/post";
import { likePost } from "~/lib/db/queries/post-like";
import { dispatchPush } from "~/lib/notifications/dispatch";
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

  const postId = Number(id);
  await likePost(postId, event.context.user.id);

  // Fire-and-forget social push to post author (skip self-likes)
  const post = await getPostById(postId);
  if (post && post.userId !== event.context.user.id) {
    void dispatchPush({
      userId: post.userId,
      type: "social.like",
      payload: {
        title: "Новый лайк",
        body: `${event.context.user.name ?? "Кто-то"} лайкнул ваш пост`,
        url: `/feed?postId=${postId}`,
      },
      digestKey: `post-${postId}-like`,
    });
  }

  const result = { success: true, liked: true };
  await recordIdempotentResponse(event, 200, result);
  return result;
});
