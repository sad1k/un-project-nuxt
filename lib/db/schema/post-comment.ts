import { relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { post } from "./post";

export const postComment = sqliteTable("postComment", {
  id: int().primaryKey({ autoIncrement: true }),
  postId: int()
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text().notNull(),
  parentId: int(),
  replyToUserId: int().references(() => user.id, { onDelete: "set null" }),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const postCommentRelations = relations(postComment, ({ one }) => ({
  post: one(post, {
    fields: [postComment.postId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [postComment.userId],
    references: [user.id],
  }),
  replyToUser: one(user, {
    fields: [postComment.replyToUserId],
    references: [user.id],
  }),
  parent: one(postComment, {
    fields: [postComment.parentId],
    references: [postComment.id],
  }),
}));

export type SelectPostComment = typeof postComment.$inferSelect;
export type InsertPostComment = typeof postComment.$inferInsert;
