import { z } from "zod";

import { createPost, getPostById } from "~/lib/db/queries/post";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const bodySchema = z.object({
  locationLogImageId: z.number(),
  caption: z.string().max(500).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
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

  const { locationLogImageId, caption } = body.data;

  try {
    const post = await createPost(locationLogImageId, event.context.user.id, caption);
    return getPostById(post.id);
  }
  catch (e) {
    const error = e as Error;
    if (error.message.includes("UNIQUE constraint failed")) {
      return sendError(
        event,
        createError({
          statusCode: 409,
          statusMessage: "Это изображение уже опубликовано",
        }),
      );
    }
    throw error;
  }
});
