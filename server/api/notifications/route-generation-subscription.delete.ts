import { z } from "zod";

import { disableRouteNotificationSubscription } from "~/lib/db/queries/route-notification";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const RouteNotificationSubscriptionDeleteSchema = z.object({
  endpoint: z.string().url(),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, RouteNotificationSubscriptionDeleteSchema.parse);
  const subscription = await disableRouteNotificationSubscription(event.context.user.id, {
    endpoint: body.endpoint,
  });

  return {
    ok: Boolean(subscription),
  };
});
