import { z } from "zod";

import { upsertRouteNotificationSubscription } from "~/lib/db/queries/route-notification";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const RouteNotificationSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
  userAgent: z.string().max(300).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, RouteNotificationSubscriptionSchema.parse);
  const subscription = await upsertRouteNotificationSubscription(event.context.user.id, {
    auth: body.keys.auth,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    userAgent: body.userAgent,
  });

  return {
    id: subscription?.id,
    ok: Boolean(subscription),
  };
});
