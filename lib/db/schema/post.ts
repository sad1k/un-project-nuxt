import { relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { locationLogImage } from "./location-log-image";
import { postComment } from "./post-comment";
import { postLike } from "./post-like";

export const post = sqliteTable("post", {
  id: int().primaryKey({ autoIncrement: true }),
  locationLogImageId: int()
    .notNull()
    .unique()
    .references(() => locationLogImage.id, { onDelete: "cascade" }),
  userId: int()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  caption: text(),
  createdAt: int()
    .notNull()
    .$default(() => Date.now()),
  updatedAt: int()
    .notNull()
    .$default(() => Date.now())
    .$onUpdate(() => Date.now()),
});

export const postRelations = relations(post, ({ one, many }) => ({
  user: one(user, {
    fields: [post.userId],
    references: [user.id],
  }),
  locationLogImage: one(locationLogImage, {
    fields: [post.locationLogImageId],
    references: [locationLogImage.id],
  }),
  likes: many(postLike),
  comments: many(postComment),
}));

export type SelectPost = typeof post.$inferSelect;
export type InsertPost = typeof post.$inferInsert;
