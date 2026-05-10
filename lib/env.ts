import { z } from "zod";

import tryParseEnv from "./try-parse-env";

const EnvBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === "")
    return false;

  return value === "true" || value === "1" || value === true;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.string(),
  TURSO_DATABASE_URL: z.string(),
  TURSO_AUTH_TOKEN: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string(),
  AUTH_GITHUB_CLIENT_ID: z.string(),
  AUTH_GITHUB_CLIENT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_BUCKET_URL: z.string(),
  SENTRY_DSN: z.string(),
  MAPBOX_TOKEN: z.string(),
  YANDEX_MAPS_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_ROUTE_MODEL: z.string().default("gpt-5.1"),
  AI_ROUTE_MOCK_ENABLED: EnvBooleanSchema,
});

export type EnvSchema = z.infer<typeof EnvSchema>;

tryParseEnv(EnvSchema);

// eslint-disable-next-line node/no-process-env
export default EnvSchema.parse(process.env);
