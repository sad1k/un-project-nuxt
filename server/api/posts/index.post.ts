import { z } from "zod";

import {
  createPost,
  getFeedPublishImageById,
  getPostById,
  isFeedPublishImageEligible,
} from "~/lib/db/queries/post";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const bodySchema = z.object({
  locationLogImageId: z.number().int().positive(),
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
  const image = await getFeedPublishImageById(locationLogImageId, event.context.user.id);

  if (!image) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "РР·РѕР±СЂР°Р¶РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ",
      }),
    );
  }

  if (!isFeedPublishImageEligible(image)) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Р”Р»СЏ РїСѓР±Р»РёРєР°С†РёРё РІ Р»РµРЅС‚Сѓ С„РѕС‚Рѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РїСѓР±Р»РёС‡РЅС‹Рј, РІРёРґРёРјС‹Рј Рё СЃ РјРµСЃС‚РѕРј РЅР° РєР°СЂС‚Рµ",
      }),
    );
  }

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
