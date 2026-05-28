import { z } from "zod";

import { upsertPushSubscription } from "~/lib/db/queries/push-subscription";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  types: z.array(z.enum(["social", "upload", "reminders", "route"])).min(1),
  userAgent: z.string().max(300).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, PushSubscriptionSchema.safeParse);
  if (!body.success) {
    return sendError(event, createError({ statusCode: 422, statusMessage: "Неверный запрос на подписку" }));
  }

  try {
    const sub = await upsertPushSubscription(event.context.user.id, {
      endpoint: body.data.endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      types: body.data.types,
      userAgent: body.data.userAgent,
    });
    return { id: sub?.id, ok: Boolean(sub) };
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка подписки";
    return sendError(event, createError({ statusCode: 403, statusMessage: message }));
  }
});
