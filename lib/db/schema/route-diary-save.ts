import { relations } from "drizzle-orm";
import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { aiRouteSession, aiRouteVariant } from "./ai-route";
import { user } from "./auth";
import { location } from "./location";
import { locationLog } from "./location-log";

export const routeDiarySave = sqliteTable(
  "routeDiarySave",
  {
    id: int().primaryKey({ autoIncrement: true }),
    userId: int()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: int()
      .notNull()
      .references(() => aiRouteSession.id, { onDelete: "cascade" }),
    variantId: int()
      .notNull()
      .references(() => aiRouteVariant.id, { onDelete: "cascade" }),
    routePointId: text().notNull(),
    locationId: int().references(() => location.id, { onDelete: "set null" }),
    locationLogId: int().references(() => locationLog.id, { onDelete: "set null" }),
    status: text().notNull().default("pending"),
    failureCode: text(),
    createdAt: int()
      .notNull()
      .$default(() => Date.now()),
    updateAt: int()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  t => [unique().on(t.userId, t.sessionId, t.variantId, t.routePointId)],
);

export const routeDiarySaveRelations = relations(routeDiarySave, ({ one }) => ({
  user: one(user, {
    fields: [routeDiarySave.userId],
    references: [user.id],
  }),
  session: one(aiRouteSession, {
    fields: [routeDiarySave.sessionId],
    references: [aiRouteSession.id],
  }),
  variant: one(aiRouteVariant, {
    fields: [routeDiarySave.variantId],
    references: [aiRouteVariant.id],
  }),
  location: one(location, {
    fields: [routeDiarySave.locationId],
    references: [location.id],
  }),
  locationLog: one(locationLog, {
    fields: [routeDiarySave.locationLogId],
    references: [locationLog.id],
  }),
}));

export type SelectRouteDiarySave = typeof routeDiarySave.$inferSelect;
