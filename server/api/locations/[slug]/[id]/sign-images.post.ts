import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { z } from "zod";

import env from "~/lib/env";
import { createS3Client } from "~/utils/create-s3-client";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ImageSchema = z.object({
  contentLength: z.number().min(1).max(MAX_IMAGE_SIZE),
  checksum: z.string(),
});

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, ImageSchema.safeParse);

  if (!body.success) {
    return sendError(event, createError({
      statusCode: 422,
      statusMessage: "Неверный запрос",
    }));
  }

  const slug = getRouterParam(event, "slug") as string;
  const id = getRouterParam(event, "id") as string;

  await event.$fetch(`/api/locations/${slug}/${id}`);

  const s3Client = createS3Client();

  const fileName = crypto.randomUUID();

  const key = `${event.context.user.id}/${id}/${fileName}.jpg`;

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: env.S3_BUCKET,
    Key: key,
    Expires: 180,
    Conditions: [
      ["content-length-range", 1, MAX_IMAGE_SIZE],
      ["eq", "$x-amz-meta-user-id", event.context.user.id.toString()],
      ["eq", "$x-amz-meta-location-log-id", id],
    ],
    Fields: {
      "x-amz-checksum-sha256": body.data.checksum,
    },
  });

  fields["x-amz-meta-user-id"] = event.context.user.id.toString();
  fields["x-amz-meta-location-log-id"] = id;

  console.log(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`);
  return {
    url,
    fields,
    key,
  };
});
