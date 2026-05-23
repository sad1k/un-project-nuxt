import { z } from "zod";

import { getPublicFeedGlobePosts } from "~/lib/db/queries/post";

const FeedGlobeQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  since: z.coerce.number().int().positive().optional(),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, FeedGlobeQuerySchema.safeParse);

  if (!query.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РіР»РѕР±СѓСЃР° Р»РµРЅС‚С‹",
    }));
  }

  const config = useRuntimeConfig();
  const posts = await getPublicFeedGlobePosts({
    limit: query.data.limit,
    since: query.data.since,
    imageBaseUrl: config.public.s3BucketUrl,
  });

  return {
    posts,
    nextSince: posts.reduce((latest, post) => Math.max(latest, post.createdAt), query.data.since ?? 0),
  };
});
