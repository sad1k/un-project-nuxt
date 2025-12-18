import { and, asc, eq } from "drizzle-orm";

import db from "..";
import { user } from "../schema/auth";
import { postComment } from "../schema/post-comment";

export async function createComment(
  postId: number,
  userId: number,
  content: string,
  parentId?: number,
  replyToUserId?: number,
) {
  const [inserted] = await db
    .insert(postComment)
    .values({
      postId,
      userId,
      content,
      parentId: parentId ?? null,
      replyToUserId: replyToUserId ?? null,
    })
    .returning();

  return inserted;
}

export async function deleteComment(commentId: number, userId: number) {
  const [deleted] = await db
    .delete(postComment)
    .where(and(eq(postComment.id, commentId), eq(postComment.userId, userId)))
    .returning();

  return deleted;
}

export async function getCommentsByPostId(postId: number) {
  const replyToUser = db
    .select({
      id: user.id,
      name: user.name,
    })
    .from(user)
    .as("replyToUser");

  const comments = await db
    .select({
      id: postComment.id,
      content: postComment.content,
      parentId: postComment.parentId,
      createdAt: postComment.createdAt,
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      replyToUserId: postComment.replyToUserId,
      replyToUserName: replyToUser.name,
    })
    .from(postComment)
    .innerJoin(user, eq(postComment.userId, user.id))
    .leftJoin(replyToUser, eq(postComment.replyToUserId, replyToUser.id))
    .where(eq(postComment.postId, postId))
    .orderBy(asc(postComment.createdAt));

  return comments;
}

export async function getCommentById(commentId: number) {
  return db.query.postComment.findFirst({
    where: eq(postComment.id, commentId),
  });
}
