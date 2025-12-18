import { relations } from "drizzle-orm";
import { int, sqliteTable, unique } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { post } from "./post";

export const postLike = sqliteTable(
  "postLike",
  {
    id: int().primaryKey({ autoIncrement: true }),
    postId: int()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: int()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: int()
      .notNull()
      .$default(() => Date.now()),
  },
  t => [unique().on(t.postId, t.userId)],
);

export const postLikeRelations = relations(postLike, ({ one }) => ({
  post: one(post, {
    fields: [postLike.postId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [postLike.userId],
    references: [user.id],
  }),
}));

export type SelectPostLike = typeof postLike.$inferSelect;
export type InsertPostLike = typeof postLike.$inferInsert;
