import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const aiRouteSession = sqliteTable("aiRouteSession", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text().notNull().default("generating"),
  cityName: text(),
  cityProviderId: text(),
  requestContextJson: text().notNull(),
  activeVariantId: int(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updateAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const aiRouteMessage = sqliteTable("aiRouteMessage", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sessionId: int()
    .notNull()
    .references(() => aiRouteSession.id, { onDelete: "cascade" }),
  role: text().notNull(),
  summary: text().notNull(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
});

export const aiRouteVariant = sqliteTable("aiRouteVariant", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sessionId: int()
    .notNull()
    .references(() => aiRouteSession.id, { onDelete: "cascade" }),
  parentVariantId: int(),
  status: text().notNull().default("generating"),
  title: text(),
  summary: text(),
  failureStage: text({ enum: ["validation", "provider", "parsing", "persistence", "diary_save", "notification", "unknown"] }),
  failureCode: text(),
  generationStartedAt: int(),
  generationHeartbeatAt: int(),
  generationCompletedAt: int(),
  runnerId: text(),
  notificationStatus: text().notNull().default("pending"),
  retryCount: int().default(0),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updateAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const aiRoutePoint = sqliteTable("aiRoutePoint", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  variantId: int()
    .notNull()
    .references(() => aiRouteVariant.id, { onDelete: "cascade" }),
  sequence: int().notNull(),
  routePointId: text().notNull(),
  day: int().notNull(),
  name: text().notNull(),
  lat: real().notNull(),
  long: real().notNull(),
  estimatedStart: text(),
  estimatedDurationMinutes: int(),
  rationale: text().notNull(),
  confidence: text().notNull(),
  alternativeForPointId: text(),
  approximateDistanceMeters: int(),
  estimatedPriceLevel: text(),
  priceConfidence: text(),
  priceSource: text(),
  sourceMetadataJson: text(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updateAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const aiRouteEvent = sqliteTable("aiRouteEvent", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sessionId: int()
    .notNull()
    .references(() => aiRouteSession.id, { onDelete: "cascade" }),
  variantId: int(),
  sequence: int().notNull(),
  type: text().notNull(),
  payloadJson: text().notNull(),
  validationStatus: text().notNull(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
});

export const aiRouteSessionRelations = relations(aiRouteSession, ({ one, many }) => ({
  user: one(user, {
    fields: [aiRouteSession.userId],
    references: [user.id],
  }),
  messages: many(aiRouteMessage),
  variants: many(aiRouteVariant),
  events: many(aiRouteEvent),
}));

export const aiRouteMessageRelations = relations(aiRouteMessage, ({ one }) => ({
  user: one(user, {
    fields: [aiRouteMessage.userId],
    references: [user.id],
  }),
  session: one(aiRouteSession, {
    fields: [aiRouteMessage.sessionId],
    references: [aiRouteSession.id],
  }),
}));

export const aiRouteVariantRelations = relations(aiRouteVariant, ({ one, many }) => ({
  user: one(user, {
    fields: [aiRouteVariant.userId],
    references: [user.id],
  }),
  session: one(aiRouteSession, {
    fields: [aiRouteVariant.sessionId],
    references: [aiRouteSession.id],
  }),
  points: many(aiRoutePoint),
}));

export const aiRoutePointRelations = relations(aiRoutePoint, ({ one }) => ({
  user: one(user, {
    fields: [aiRoutePoint.userId],
    references: [user.id],
  }),
  variant: one(aiRouteVariant, {
    fields: [aiRoutePoint.variantId],
    references: [aiRouteVariant.id],
  }),
}));

export const aiRouteEventRelations = relations(aiRouteEvent, ({ one }) => ({
  user: one(user, {
    fields: [aiRouteEvent.userId],
    references: [user.id],
  }),
  session: one(aiRouteSession, {
    fields: [aiRouteEvent.sessionId],
    references: [aiRouteSession.id],
  }),
}));

export type SelectAiRouteSession = typeof aiRouteSession.$inferSelect;
export type SelectAiRouteMessage = typeof aiRouteMessage.$inferSelect;
export type SelectAiRouteVariant = typeof aiRouteVariant.$inferSelect;
export type SelectAiRoutePoint = typeof aiRoutePoint.$inferSelect;
export type SelectAiRouteEvent = typeof aiRouteEvent.$inferSelect;
