import { relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const routeNotificationSubscription = sqliteTable("routeNotificationSubscription", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text().notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text(),
  disabledAt: int(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updateAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const routeNotificationSubscriptionRelations = relations(routeNotificationSubscription, ({ one }) => ({
  user: one(user, {
    fields: [routeNotificationSubscription.userId],
    references: [user.id],
  }),
}));

export type SelectRouteNotificationSubscription = typeof routeNotificationSubscription.$inferSelect;
