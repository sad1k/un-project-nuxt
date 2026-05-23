import { createEventStream } from "h3";
import { z } from "zod";

import { getPublicFeedGlobePosts } from "~/lib/db/queries/post";

const FeedGlobeStreamQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
});

const STREAM_INTERVAL_MS = 5000;

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, FeedGlobeStreamQuerySchema.safeParse);

  if (!query.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Некорректные параметры live-глобуса ленты",
    }));
  }

  const config = useRuntimeConfig();
  const eventStream = createEventStream(event);
  let since = query.data.since;

  async function pushNewPosts() {
    const posts = await getPublicFeedGlobePosts({
      since,
      limit: 25,
      imageBaseUrl: config.public.s3BucketUrl,
    });

    if (posts.length === 0)
      return;

    since = posts.reduce((latest, post) => Math.max(latest, post.createdAt), since);
    await eventStream.push(JSON.stringify({
      posts,
      nextSince: since,
    }));
  }

  await pushNewPosts();

  const interval = setInterval(() => {
    pushNewPosts().catch(() => {});
  }, STREAM_INTERVAL_MS);

  eventStream.onClosed(async () => {
    clearInterval(interval);
    await eventStream.close();
  });

  return eventStream.send();
});

