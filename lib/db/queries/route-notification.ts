import { and, eq, isNull } from "drizzle-orm";

import db from "..";
import { routeNotificationSubscription } from "../schema";

export async function upsertRouteNotificationSubscription(
  userId: number,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  },
) {
  const existing = await db.query.routeNotificationSubscription.findFirst({
    where: and(
      eq(routeNotificationSubscription.userId, userId),
      eq(routeNotificationSubscription.endpoint, input.endpoint),
    ),
  });

  if (existing) {
    const [updatedSubscription] = await db
      .update(routeNotificationSubscription)
      .set({
        auth: input.auth,
        disabledAt: null,
        p256dh: input.p256dh,
        userAgent: input.userAgent,
      })
      .where(and(
        eq(routeNotificationSubscription.id, existing.id),
        eq(routeNotificationSubscription.userId, userId),
      ))
      .returning();

    return updatedSubscription;
  }

  const [createdSubscription] = await db
    .insert(routeNotificationSubscription)
    .values({
      auth: input.auth,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      userAgent: input.userAgent,
      userId,
    })
    .returning();

  return createdSubscription;
}

export async function disableRouteNotificationSubscription(
  userId: number,
  input: {
    endpoint: string;
  },
) {
  const [updatedSubscription] = await db
    .update(routeNotificationSubscription)
    .set({ disabledAt: Date.now() })
    .where(and(
      eq(routeNotificationSubscription.userId, userId),
      eq(routeNotificationSubscription.endpoint, input.endpoint),
    ))
    .returning();

  return updatedSubscription;
}

export async function findActiveRouteNotificationSubscriptionsByUserId(userId: number) {
  return db.query.routeNotificationSubscription.findMany({
    where: and(
      eq(routeNotificationSubscription.userId, userId),
      isNull(routeNotificationSubscription.disabledAt),
    ),
  });
}
