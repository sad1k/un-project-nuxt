import { int, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const idempotencyKey = sqliteTable("idempotencyKey", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  clientOpId: text().notNull(),
  endpoint: text().notNull(),
  statusCode: int().notNull(),
  responseBody: text().notNull(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
}, table => [
  uniqueIndex("idempotency_user_op_endpoint_unique").on(table.userId, table.clientOpId, table.endpoint),
]);

export type SelectIdempotencyKey = typeof idempotencyKey.$inferSelect;
