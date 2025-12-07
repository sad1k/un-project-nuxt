import type { UserWithId } from "~/lib/db/schema";

import { auth } from "~/lib/auth";

export default defineEventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({
      headers: event.headers,
    });

    event.context.user = session?.user as unknown as UserWithId;
    if (event.path.startsWith("/dashboard")) {
      if (!session?.user) {
        await sendRedirect(event, "/", 302);
      }
    }
  }
  catch (error) {
    console.error("Auth middleware error:", error);
    if (event.path.startsWith("/dashboard")) {
      await sendRedirect(event, "/", 302);
    }
  }
});
