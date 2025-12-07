import { S3Client } from "@aws-sdk/client-s3";

import env from "~/lib/env";

export function createS3Client() {
  console.log(env.S3_ENDPOINT, "S3_ENDPOINT");

  const s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    signingRegion: env.S3_REGION,
  });

  return s3Client;
}
