import type { z } from "zod/v4";

import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

import type { SelectLocationLog } from "./location-log";

import { user } from "./auth";
import { locationLog } from "./location-log";

export const location = sqliteTable(
  "location",
  {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    slug: text().notNull().unique(),
    description: text(),
    lat: real().notNull(),
    long: real().notNull(),
    userId: int()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: int()
      .notNull()
      .$default(() => Date.now()),
    updateAt: int()
      .notNull()
      .$default(() => Date.now())
      .$onUpdate(() => Date.now()),
  },
  t => [unique().on(t.name, t.userId)],
);

export const InsertLocationSchema = createInsertSchema(location, {
  name: field => field.min(1).max(100),
  description: field => field.max(1000),
  lat: field => field.min(-90).max(90),
  long: field => field.min(-180).max(180),
}).omit({
  id: true,
  slug: true,
  userId: true,
  createdAt: true,
  updateAt: true,
});

export type InsertLocation = z.infer<typeof InsertLocationSchema>;

export const locationRelations = relations(location, ({ many }) => ({
  locationLogs: many(locationLog),
}));

export type SelectLocation = typeof location.$inferSelect;
export type SelectLocationWithLogs = SelectLocation & {
  locationLogs: SelectLocationLog[];
};
