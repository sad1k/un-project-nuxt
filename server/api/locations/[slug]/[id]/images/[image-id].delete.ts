import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

import {
  deleteLocationLogImageById,
} from "~/lib/db/queries/location";
import env from "~/lib/env";
import { createS3Client } from "~/utils/create-s3-client";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;

  const imageId = getRouterParam(event, "image-id") as string;

  if (!z.coerce.number().safeParse(imageId).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID",
      }),
    );
  }

  const id = getRouterParam(event, "id") as string;
  if (!z.coerce.number().safeParse(id).success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный ID",
      }),
    );
  }

  await event.$fetch(`/api/locations/${slug}/${id}`);

  const deletedLog = await deleteLocationLogImageById(Number(imageId), event.context.user.id);

  if (deletedLog) {
    const s3Client = createS3Client();
    const command = new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: deletedLog.key,
    });
    await s3Client.send(command);
  }

  setResponseStatus(event, 204);
});
