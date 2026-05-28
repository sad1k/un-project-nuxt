import { z } from "zod";

import { removeTypeForUser } from "~/lib/db/queries/push-subscription";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const TypeSchema = z.enum(["social", "upload", "reminders", "route"]);

export default defineAuthenticatedHandler(async (event) => {
  const raw = getRouterParam(event, "type");
  const parsed = TypeSchema.safeParse(raw);
  if (!parsed.success)
    return sendError(event, createError({ statusCode: 422, statusMessage: "Неизвестный тип подписки" }));

  await removeTypeForUser(event.context.user.id, parsed.data);
  return { ok: true };
});
