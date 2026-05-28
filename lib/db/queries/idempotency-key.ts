import { and, eq, lt } from "drizzle-orm";

import db from "..";
import { idempotencyKey } from "../schema/idempotency-key";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function findIdempotencyHit(userId: number, clientOpId: string, endpoint: string) {
  const cutoff = Date.now() - TTL_MS;
  const hit = await db.query.idempotencyKey.findFirst({
    where: and(
      eq(idempotencyKey.userId, userId),
      eq(idempotencyKey.clientOpId, clientOpId),
      eq(idempotencyKey.endpoint, endpoint),
    ),
  });
  if (!hit)
    return null;
  if (hit.createdAt < cutoff)
    return null;
  return hit;
}

export async function recordIdempotencyResult(
  userId: number,
  clientOpId: string,
  endpoint: string,
  statusCode: number,
  responseBody: string,
) {
  await db
    .insert(idempotencyKey)
    .values({ userId, clientOpId, endpoint, statusCode, responseBody })
    .onConflictDoNothing();
}

export async function purgeExpiredIdempotencyKeys() {
  const cutoff = Date.now() - TTL_MS;
  await db.delete(idempotencyKey).where(lt(idempotencyKey.createdAt, cutoff));
}
