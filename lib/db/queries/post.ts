import { and, desc, eq, lt, sql } from "drizzle-orm";

import db from "..";
import { user } from "../schema/auth";
import { locationLogImage } from "../schema/location-log-image";
import { post } from "../schema/post";
import { postComment } from "../schema/post-comment";
import { postLike } from "../schema/post-like";

export async function createPost(locationLogImageId: number, userId: number, caption?: string) {
  const [inserted] = await db
    .insert(post)
    .values({
      locationLogImageId,
      userId,
      caption,
    })
    .returning();

  return inserted;
}

export async function deletePost(postId: number, userId: number) {
  const [deleted] = await db
    .delete(post)
    .where(and(eq(post.id, postId), eq(post.userId, userId)))
    .returning();

  return deleted;
}

export async function getPostById(postId: number) {
  return db.query.post.findFirst({
    where: eq(post.id, postId),
    with: {
      user: true,
      locationLogImage: true,
    },
  });
}

export async function getFeed(cursor?: number, limit = 20) {
  const whereClause = cursor ? lt(post.id, cursor) : undefined;

  const posts = await db
    .select({
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      imageKey: locationLogImage.key,
      imageDescription: locationLogImage.description,
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      likesCount: sql<number>`(SELECT COUNT(*) FROM ${postLike} WHERE ${postLike.postId} = ${post.id})`,
      commentsCount: sql<number>`(SELECT COUNT(*) FROM ${postComment} WHERE ${postComment.postId} = ${post.id})`,
    })
    .from(post)
    .innerJoin(user, eq(post.userId, user.id))
    .innerJoin(locationLogImage, eq(post.locationLogImageId, locationLogImage.id))
    .where(whereClause)
    .orderBy(desc(post.createdAt))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, -1) : posts;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function getFeedWithUserLikes(cursor?: number, limit = 20, currentUserId?: number) {
  const whereClause = cursor ? lt(post.id, cursor) : undefined;

  const posts = await db
    .select({
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      imageKey: locationLogImage.key,
      imageDescription: locationLogImage.description,
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      likesCount: sql<number>`(SELECT COUNT(*) FROM ${postLike} WHERE ${postLike.postId} = ${post.id})`,
      commentsCount: sql<number>`(SELECT COUNT(*) FROM ${postComment} WHERE ${postComment.postId} = ${post.id})`,
      isLikedByUser: currentUserId
        ? sql<boolean>`EXISTS(SELECT 1 FROM ${postLike} WHERE ${postLike.postId} = ${post.id} AND ${postLike.userId} = ${currentUserId})`
        : sql<boolean>`0`,
    })
    .from(post)
    .innerJoin(user, eq(post.userId, user.id))
    .innerJoin(locationLogImage, eq(post.locationLogImageId, locationLogImage.id))
    .where(whereClause)
    .orderBy(desc(post.createdAt))
    .limit(limit + 1);

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, -1) : posts;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function getUserLocationLogImages(userId: number) {
  const images = await db
    .select({
      id: locationLogImage.id,
      key: locationLogImage.key,
      description: locationLogImage.description,
      createdAt: locationLogImage.createdAt,
      isPosted: sql<boolean>`EXISTS(SELECT 1 FROM ${post} WHERE ${post.locationLogImageId} = ${locationLogImage.id})`,
    })
    .from(locationLogImage)
    .where(eq(locationLogImage.userId, userId))
    .orderBy(desc(locationLogImage.createdAt));

  return images;
}
