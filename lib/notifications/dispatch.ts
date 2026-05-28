import webpush from "web-push";

import { getSubscriptionsByUserAndType, removeByEndpoint } from "~/lib/db/queries/push-subscription";
import env from "~/lib/env";

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured)
    return true;
  if (!env.ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY || !env.ROUTE_NOTIFICATION_VAPID_PRIVATE_KEY)
    return false;
  const mailto = env.ROUTE_NOTIFICATION_VAPID_MAILTO || "noreply@wanderlog.app";
  webpush.setVapidDetails(
    `mailto:${mailto}`,
    env.ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY,
    env.ROUTE_NOTIFICATION_VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
  return true;
}

type DigestEntry = { count: number; firstAt: number };
const recentDigests = new Map<string, DigestEntry>();
const DIGEST_WINDOW_MS = 10 * 60 * 1000;

function digestMerge(key: string, basePayload: Record<string, unknown>) {
  const now = Date.now();
  const entry = recentDigests.get(key);
  if (entry && now - entry.firstAt < DIGEST_WINDOW_MS) {
    entry.count += 1;
    return {
      ...basePayload,
      digestCount: entry.count,
      title: `${entry.count} новых событий`,
    };
  }
  recentDigests.set(key, { count: 1, firstAt: now });
  return basePayload;
}

export type DispatchInput = {
  userId: number;
  type: string;
  payload: Record<string, unknown>;
  /** Optional digest key for `social.*` types — collapses repeated events into a counted summary. */
  digestKey?: string;
};

export async function dispatchPush(input: DispatchInput): Promise<void> {
  if (!ensureVapid())
    return;

  let body = input.payload;
  if (input.digestKey && input.type.startsWith("social."))
    body = digestMerge(`${input.userId}:${input.digestKey}`, body);

  const subs = await getSubscriptionsByUserAndType(input.userId, input.type);
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ type: input.type, ...body }),
      );
    }
    catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410)
        await removeByEndpoint(sub.endpoint);
    }
  }));
}
