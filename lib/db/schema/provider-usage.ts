import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Counts billable provider calls per time window so a paid provider (currently the TripAdvisor
// photos endpoint) can be capped before it runs up the bill. `windowKey` encodes provider +
// granularity + date, e.g. "tripadvisor:day:2026-06-05" or "tripadvisor:month:2026-06".
export const providerUsage = sqliteTable("providerUsage", {
  windowKey: text().primaryKey(),
  count: int().notNull().default(0),
  updatedAt: int()
    .notNull()
    .$default(() => Date.now()),
});

export type SelectProviderUsage = typeof providerUsage.$inferSelect;
