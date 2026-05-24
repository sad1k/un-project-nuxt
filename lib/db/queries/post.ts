import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";

import db from "..";
import { user } from "../schema/auth";
import { locationLogImage } from "../schema/location-log-image";
import { post } from "../schema/post";
import { postComment } from "../schema/post-comment";
import { postLike } from "../schema/post-like";

export type PublicFeedGlobePostRow = {
  id: number;
  caption: string | null;
  createdAt: number;
  imageKey: string;
  publicPlaceName: string | null;
  publicLat: number | null;
  publicLong: number | null;
  authorName: string;
  authorImage: string | null;
};

export type PublicFeedGlobePost = {
  id: number;
  caption: string | null;
  createdAt: number;
  image: {
    url: string;
    alt: string;
  };
  place: {
    name: string;
    lat: number;
    long: number;
  };
  author: {
    name: string;
    image: string | null;
  };
};

function publicGlobePostConditions() {
  return [
    eq(locationLogImage.visibility, "public"),
    eq(locationLogImage.moderationStatus, "visible"),
    isNotNull(locationLogImage.publishedAt),
    isNotNull(locationLogImage.publicPlaceName),
    isNotNull(locationLogImage.publicLat),
    isNotNull(locationLogImage.publicLong),
  ];
}

export function serializePublicFeedGlobePost(row: PublicFeedGlobePostRow, imageBaseUrl: string): PublicFeedGlobePost | null {
  if (
    !row.publicPlaceName
    || row.publicLat === null
    || row.publicLong === null
  ) {
    return null;
  }

  return {
    id: row.id,
    caption: row.caption,
    createdAt: row.createdAt,
    image: {
      url: `${imageBaseUrl.replace(/\/$/, "")}/${row.imageKey}`,
      alt: row.publicPlaceName,
    },
    place: {
      name: row.publicPlaceName,
      lat: row.publicLat,
      long: row.publicLong,
    },
    author: {
      name: row.authorName,
      image: row.authorImage,
    },
  };
}

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

export async function getFeedWithUserLikes(cursor?: number, limit = 20, currentUserId?: number, authorId?: number) {
  const conditions = [];

  if (cursor)
    conditions.push(lt(post.id, cursor));

  if (authorId)
    conditions.push(eq(post.userId, authorId));

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const posts = await db
    .select({
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      imageKey: locationLogImage.key,
      imageDescription: locationLogImage.description,
      publicPlaceName: locationLogImage.publicPlaceName,
      publicLat: locationLogImage.publicLat,
      publicLong: locationLogImage.publicLong,
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

export async function getPublicFeedGlobePostRows(input: {
  limit?: number;
  since?: number;
} = {}) {
  const conditions = publicGlobePostConditions();
  if (input.since)
    conditions.push(gt(post.createdAt, input.since));

  return db
    .select({
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      imageKey: locationLogImage.key,
      publicPlaceName: locationLogImage.publicPlaceName,
      publicLat: locationLogImage.publicLat,
      publicLong: locationLogImage.publicLong,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(post)
    .innerJoin(user, eq(post.userId, user.id))
    .innerJoin(locationLogImage, eq(post.locationLogImageId, locationLogImage.id))
    .where(and(...conditions))
    .orderBy(desc(post.createdAt))
    .limit(input.limit ?? 100);
}

export async function getPublicFeedGlobePosts(input: {
  limit?: number;
  since?: number;
  imageBaseUrl: string;
}) {
  const rows = await getPublicFeedGlobePostRows(input);

  return rows
    .map(row => serializePublicFeedGlobePost(row, input.imageBaseUrl))
    .filter((item): item is PublicFeedGlobePost => item !== null);
}

export async function getFeedPublishImageById(locationLogImageId: number, userId: number) {
  return db.query.locationLogImage.findFirst({
    where: and(
      eq(locationLogImage.id, locationLogImageId),
      eq(locationLogImage.userId, userId),
    ),
  });
}

export function isFeedPublishImageEligible(image: Awaited<ReturnType<typeof getFeedPublishImageById>>) {
  return !!image
    && image.visibility === "public"
    && image.moderationStatus === "visible"
    && image.publishedAt !== null
    && !!image.publicPlaceName
    && image.publicLat !== null
    && image.publicLong !== null;
}

export async function getUserFeedPublishImages(userId: number) {
  const images = await db
    .select({
      id: locationLogImage.id,
      key: locationLogImage.key,
      description: locationLogImage.description,
      createdAt: locationLogImage.createdAt,
      visibility: locationLogImage.visibility,
      publicPlaceName: locationLogImage.publicPlaceName,
      publicLat: locationLogImage.publicLat,
      publicLong: locationLogImage.publicLong,
      publishedAt: locationLogImage.publishedAt,
      moderationStatus: locationLogImage.moderationStatus,
      isPosted: sql<boolean>`EXISTS(SELECT 1 FROM ${post} WHERE ${post.locationLogImageId} = ${locationLogImage.id})`,
    })
    .from(locationLogImage)
    .where(eq(locationLogImage.userId, userId))
    .orderBy(desc(locationLogImage.createdAt));

  return images;
}

export const getUserLocationLogImages = getUserFeedPublishImages;
