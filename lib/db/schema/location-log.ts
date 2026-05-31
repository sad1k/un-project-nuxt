import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "./auth";
import { location } from "./location";
import { locationLogImage, type SelectLocationLogImage } from "./location-log-image";

export const locationLog = sqliteTable("locationLog", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  description: text(),
  startedAt: int().notNull(),
  endedAt: int().notNull(),
  lat: real().notNull(),
  long: real().notNull(),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  locationId: int()
    .notNull()
    .references(() => location.id, { onDelete: "cascade" }),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updateAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const locationLogRelations = relations(locationLog, ({ one, many }) => ({
  location: one(location, {
    fields: [locationLog.locationId],
    references: [location.id],
  }),
  images: many(locationLogImage),
}));

export const InsertLocationLogSchema = createInsertSchema(locationLog, {
  name: field => field.min(1).max(100),
  description: field => field.max(1000),
  lat: field => field.min(-90).max(90),
  long: field => field.min(-180).max(180),
})
  .omit({
    id: true,
    userId: true,
    locationId: true,
    createdAt: true,
    updateAt: true,
  })
  .superRefine((value, ctx) => {
    if (value.startedAt > value.endedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Начало должно быть раньше конца",
        path: ["startedAt"],
      });
    }
    else if (value.endedAt < value.startedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Конец должен быть позже начала",
        path: ["endedAt"],
      });
    }
  });

export type InsertLocationLog = z.infer<typeof InsertLocationLogSchema>;

export type SelectLocationLog = typeof locationLog.$inferSelect & {
  images: SelectLocationLogImage[];
};
