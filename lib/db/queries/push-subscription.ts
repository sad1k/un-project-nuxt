import { eq } from "drizzle-orm";

import db from "..";
import { pushSubscription } from "../schema/push-subscription";

export async function upsertPushSubscription(
  userId: number,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    types: string[];
    userAgent?: string;
  },
) {
  const existing = await db.query.pushSubscription.findFirst({
    where: eq(pushSubscription.endpoint, input.endpoint),
  });

  if (existing) {
    // Endpoint uniqueness is global; reject if a different user owns it
    if (existing.userId !== userId)
      throw new Error("Endpoint already registered by another user");

    const [updated] = await db
      .update(pushSubscription)
      .set({
        p256dh: input.p256dh,
        auth: input.auth,
        types: input.types,
        userAgent: input.userAgent,
      })
      .where(eq(pushSubscription.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(pushSubscription)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      types: input.types,
      userAgent: input.userAgent,
    })
    .returning();
  return created;
}

export async function getSubscriptionsByUserAndType(userId: number, type: string) {
  const all = await db.query.pushSubscription.findMany({
    where: eq(pushSubscription.userId, userId),
  });
  const prefix = type.split(".")[0];
  return all.filter(sub => sub.types.includes(prefix));
}

export async function removeByEndpoint(endpoint: string) {
  await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
}

export async function removeTypeForUser(userId: number, type: string) {
  const prefix = type.split(".")[0];
  const subs = await db.query.pushSubscription.findMany({
    where: eq(pushSubscription.userId, userId),
  });
  for (const sub of subs) {
    const remaining = sub.types.filter(t => t !== prefix);
    if (remaining.length === 0) {
      await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));
    }
    else {
      await db
        .update(pushSubscription)
        .set({ types: remaining })
        .where(eq(pushSubscription.id, sub.id));
    }
  }
}

export async function getAllUserSubscriptions(userId: number) {
  return db.query.pushSubscription.findMany({
    where: eq(pushSubscription.userId, userId),
  });
}

