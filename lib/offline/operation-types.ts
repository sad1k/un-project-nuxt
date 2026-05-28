export type PendingStatus = "pending" | "auth_required" | "conflict" | "invalid" | "expired" | "corrupted";

export type LogCreateOp = {
  type: "log.create";
  payload: { locationSlug: string; name: string; description?: string; lat?: number; long?: number; startedAt?: number; endedAt?: number };
};

export type LogUpdateOp = {
  type: "log.update";
  payload: { locationSlug: string; logId: number; name?: string; description?: string; startedAt?: number; endedAt?: number };
};

export type PhotoUploadOp = {
  type: "photo.upload";
  payload: { locationSlug: string; logId: number; blobRef: string; mimeType: string; checksum: string; partial?: "s3-done"; key?: string };
};

export type LikeOp = {
  type: "post.like";
  payload: { postId: number; action: "like" | "unlike" };
};

export type CommentOp = {
  type: "post.comment";
  payload: { postId: number; content: string; parentId?: number; replyToUserId?: number };
};

export type PendingOpKind = LogCreateOp | LogUpdateOp | PhotoUploadOp | LikeOp | CommentOp;

export type PendingOp = PendingOpKind & {
  opId: string;
  status: PendingStatus;
  createdAt: number;
  updatedAt: number;
  retries: number;
  lastError?: string;
};

export type PushSettings = {
  social: boolean;
  upload: boolean;
  reminders: boolean;
  route: boolean;
};
