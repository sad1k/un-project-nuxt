import { z } from "zod";

import { getFeedWithUserLikes } from "~/lib/db/queries/post";

const querySchema = z.object({
  author: z.coerce.number().int().positive().optional(),
  cursor: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return sendError(
      event,
      createError({
        statusCode: 400,
        statusMessage: "Неверные параметры запроса",
      }),
    );
  }

  const { author, cursor, limit } = parsed.data;
  const currentUserId = event.context.user?.id;

  return getFeedWithUserLikes(cursor, limit, currentUserId, author);
});
