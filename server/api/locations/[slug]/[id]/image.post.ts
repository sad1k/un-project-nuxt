import { GetObjectCommand } from "@aws-sdk/client-s3";

import { insertLocationLogImage } from "~/lib/db/queries/location-log-image";
import { InsertLocationLogImageSchema } from "~/lib/db/schema/location-log-image";
import env from "~/lib/env";
import { createS3Client } from "~/utils/create-s3-client";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(
    event,
    InsertLocationLogImageSchema.safeParse,
  );
  if (!body.success) {
    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage: "Неверный запрос",
      }),
    );
  }

  const slug = getRouterParam(event, "slug") as string;
  const id = getRouterParam(event, "id") as string;

  await event.$fetch(`/api/locations/${slug}/${id}`);

  const s3Client = createS3Client();

  const commmand = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: body.data.key,
  });

  const response = await s3Client.send(commmand);

  const metadata = response.Metadata;

  console.log(metadata, "metadata");

  if (
    !metadata
    || metadata["user-id"] !== event.context.user.id.toString()
    || metadata["location-log-id"] !== id
  ) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Изображение не найдено",
      }),
    );
  }

  const insertedImage = await insertLocationLogImage(body.data, event.context.user.id, Number(id));

  return insertedImage;
});
