import type { z } from "zod";

import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

import { user } from "./auth";
import { locationLog, type SelectLocationLog } from "./location-log";

export const publicPhotoVisibilityValues = ["private", "public"] as const;
export const publicPhotoModerationStatusValues = ["visible", "hidden"] as const;
export const publicPhotoLocationSourceValues = ["gps", "approximate", "manual"] as const;

export const locationLogImage = sqliteTable("locationLogImage", {
  id: int().primaryKey({ autoIncrement: true }),
  key: text().notNull(),
  description: text(),
  locationLogId: int().notNull().references(() => locationLog.id, { onDelete: "cascade" }),
  userId: int().notNull().references(() => user.id, { onDelete: "cascade" }),
  visibility: text({ enum: publicPhotoVisibilityValues }).notNull().default("private"),
  publicPlaceName: text(),
  publicLat: real(),
  publicLong: real(),
  publishedAt: int(),
  moderationStatus: text({ enum: publicPhotoModerationStatusValues }).notNull().default("visible"),
  locationAccuracy: real(),
  locationSource: text({ enum: publicPhotoLocationSourceValues }),
  createdAt: int().notNull().$default(() => Date.now()),
  updateAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});

const numericKeyRegex = /^\d+\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

export const InsertLocationLogImageSchema = createInsertSchema(locationLogImage, {
  key: field => field.regex(numericKeyRegex, "Неверный формат ключа"),
}).omit({
  id: true,
  userId: true,
  locationLogId: true,
  visibility: true,
  publicPlaceName: true,
  publicLat: true,
  publicLong: true,
  publishedAt: true,
  moderationStatus: true,
  locationAccuracy: true,
  locationSource: true,
  createdAt: true,
  updateAt: true,
});
// @ts-expect-error - ignore type error
export type InsertLocationLogImage = z.infer<typeof InsertLocationLogImageSchema>;

export type SelectLocationLogImage = typeof locationLogImage.$inferSelect & {
  locationLog: SelectLocationLog;
};

export const locationLogImageRelations = relations(locationLogImage, ({ one }) => ({
  locationLog: one(locationLog, {
    fields: [locationLogImage.locationLogId],
    references: [locationLog.id],
  }),
}));
