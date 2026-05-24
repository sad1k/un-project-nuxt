import { z } from "zod";

import env from "~/lib/env";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const QuerySchema = z.object({
  name: z.string().trim().min(1).max(500).regex(/^places\/[\w-]+\/photos\/[\w-]+$/, "Invalid photo resource"),
});

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);

  if (!env.GOOGLE_PLACES_API_KEY) {
    throw createError({
      statusCode: 404,
      statusMessage: "Фото места недоступно",
    });
  }

  const url = new URL(`https://places.googleapis.com/v1/${query.name}/media`);
  url.searchParams.set("maxWidthPx", "720");
  url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw createError({
      statusCode: 404,
      statusMessage: "Фото места недоступно",
    });
  }

  return new Response(response.body, {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-type": response.headers.get("content-type") || "image/jpeg",
    },
  });
});
