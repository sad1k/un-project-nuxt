import { relations } from "drizzle-orm";
import { int, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const pushSubscription = sqliteTable("pushSubscription", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text().notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  /** JSON array of subscription type prefixes user opted into: e.g. ["social", "upload", "reminders", "route"]. */
  types: text({ mode: "json" }).$type<string[]>().notNull(),
  userAgent: text(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
}, table => [
  uniqueIndex("push_subscription_endpoint_unique").on(table.endpoint),
]);

export const pushSubscriptionRelations = relations(pushSubscription, ({ one }) => ({
  user: one(user, {
    fields: [pushSubscription.userId],
    references: [user.id],
  }),
}));

export type SelectPushSubscription = typeof pushSubscription.$inferSelect;
