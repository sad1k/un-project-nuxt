import { eq, sql } from "drizzle-orm";

import db from "..";
import { providerUsage } from "../schema/provider-usage";

export async function getProviderUsageCount(windowKey: string): Promise<number> {
  const row = await db.query.providerUsage.findFirst({
    where: eq(providerUsage.windowKey, windowKey),
  });

  return row?.count ?? 0;
}

export async function incrementProviderUsage(windowKeys: string[]): Promise<void> {
  for (const windowKey of windowKeys) {
    // Atomic increment via SQL `count = count + 1` so concurrent calls don't clobber each other.
    await db
      .insert(providerUsage)
      .values({ windowKey, count: 1, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: providerUsage.windowKey,
        set: {
          count: sql`${providerUsage.count} + 1`,
          updatedAt: Date.now(),
        },
      });
  }
}
