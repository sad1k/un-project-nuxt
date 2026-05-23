import { eq } from "drizzle-orm";

import db from "~/lib/db";
import { user } from "~/lib/db/schema";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const persistedUser = await db.query.user.findFirst({
    columns: {
      email: true,
      id: true,
      image: true,
      name: true,
      role: true,
    },
    where: eq(user.id, event.context.user.id),
  });

  if (!persistedUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "Пользователь не найден",
    });
  }

  return persistedUser;
});
