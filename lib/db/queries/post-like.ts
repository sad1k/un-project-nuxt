import { and, eq } from "drizzle-orm";

import db from "..";
import { postLike } from "../schema/post-like";

export async function likePost(postId: number, userId: number) {
  const [inserted] = await db
    .insert(postLike)
    .values({
      postId,
      userId,
    })
    .onConflictDoNothing()
    .returning();

  return inserted;
}

export async function unlikePost(postId: number, userId: number) {
  const [deleted] = await db
    .delete(postLike)
    .where(and(eq(postLike.postId, postId), eq(postLike.userId, userId)))
    .returning();

  return deleted;
}

export async function isPostLikedByUser(postId: number, userId: number) {
  const like = await db.query.postLike.findFirst({
    where: and(eq(postLike.postId, postId), eq(postLike.userId, userId)),
  });

  return !!like;
}
