import type { H3Event, H3EventContext } from "h3";

import { eq } from "drizzle-orm";

import type { UserWithId } from "~/lib/db/schema";

import db from "~/lib/db";
import { user } from "~/lib/db/schema";

import defineAuthenticatedHandler from "./define-authenticated-handler";

type AdminEvent = H3Event & {
  context: H3EventContext & {
    user: UserWithId & { role: "admin" };
  };
};

export default function defineAdminHandler<T>(handler: (event: AdminEvent) => T) {
  return defineAuthenticatedHandler(async (event) => {
    if (!await hasAdminRole(event.context.user)) {
      return sendError(event, createError({
        statusCode: 403,
        statusMessage: "Forbidden",
      }));
    }

    event.context.user.role = "admin";
    return handler(event as AdminEvent);
  });
}

async function hasAdminRole(currentUser: UserWithId) {
  if (currentUser.role === "admin")
    return true;

  const persistedUser = await db.query.user.findFirst({
    columns: {
      role: true,
    },
    where: eq(user.id, currentUser.id),
  });

  return persistedUser?.role === "admin";
}
