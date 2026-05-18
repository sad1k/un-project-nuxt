import { relations } from "drizzle-orm";
import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { aiRouteSession, aiRouteVariant } from "./ai-route";
import { user } from "./auth";

export const routePlaceStory = sqliteTable(
  "routePlaceStory",
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
    status: text().notNull().default("ready"),
    failureCode: text(),
    title: text().notNull(),
    sourceNote: text().notNull(),
    sourceSupportJson: text().notNull(),
    voiceId: text().notNull(),
    audioObjectKey: text(),
    audioContentType: text(),
    audioByteLength: int(),
    audioDurationSeconds: int(),
    generatedAt: int(),
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

export const routePlaceStoryRelations = relations(routePlaceStory, ({ one }) => ({
  user: one(user, {
    fields: [routePlaceStory.userId],
    references: [user.id],
  }),
  session: one(aiRouteSession, {
    fields: [routePlaceStory.sessionId],
    references: [aiRouteSession.id],
  }),
  variant: one(aiRouteVariant, {
    fields: [routePlaceStory.variantId],
    references: [aiRouteVariant.id],
  }),
}));

export type SelectRoutePlaceStory = typeof routePlaceStory.$inferSelect;
