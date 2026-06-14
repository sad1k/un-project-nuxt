import { z } from "zod";

import tryParseEnv from "./try-parse-env";

const EnvBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === "")
    return false;

  if (typeof value === "string") {
    const normalized = value.trim().replace(/^["']|["']$/g, "").toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return value === true;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.string(),
  TURSO_DATABASE_URL: z.string(),
  TURSO_AUTH_TOKEN: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string(),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
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
  PMTILES_URL: z.string().url().optional(),
  YANDEX_MAPS_API_KEY: z.string(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  TWOGIS_API_KEY: z.string().optional(),
  // Public key the 2GIS web client uses for its unofficial reviews endpoint (review text only;
  // the rating still comes from the official Catalog API). Optional override of the in-code
  // public default.
  TWOGIS_REVIEWS_API_KEY: z.string().optional(),
  MAPILLARY_ACCESS_TOKEN: z.string().optional(),
  WIKIMAPIA_API_KEY: z.string().optional(),
  FLICKR_API_KEY: z.string().optional(),
  TRIPADVISOR_API_KEY: z.string().optional(),
  // Billing caps for the paid TripAdvisor photos endpoint. Conservative defaults keep usage well
  // inside the free 5000/month tier; override via env to tune.
  TRIPADVISOR_DAILY_LIMIT: z.coerce.number().int().positive().default(150),
  TRIPADVISOR_MONTHLY_LIMIT: z.coerce.number().int().positive().default(4500),
  // TripAdvisor reviews + photos share one billing quota. Keep the (paid) review fallback OFF
  // by default so the budget stays for photos; set to true to allow it when the free providers
  // (2GIS/Google) return no review text. Unset/empty -> false.
  TRIPADVISOR_REVIEWS_ENABLED: EnvBooleanSchema,
  AI_ROUTE_PROVIDER: z.enum(["openai_compatible", "cerebras", "mistral", "openrouter", "aihubmix"]).default("openai_compatible"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_ROUTE_API: z.enum(["responses", "chat_completions"]).default("responses"),
  OPENAI_ROUTE_MODEL: z.string().default("gpt-5.1"),
  OPENAI_TTS_MODEL: z.string().default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().default("coral"),
  CEREBRAS_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_ROUTE_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_ROUTE_MODEL: z.string().optional(),
  OPENROUTER_PROVIDER_ORDER: z.string().optional(),
  AIHUBMIX_API_KEY: z.string().optional(),
  AIHUBMIX_ROUTE_MODEL: z.string().optional(),
  AI_ROUTE_MOCK_ENABLED: EnvBooleanSchema,
  ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY: z.string().optional(),
  ROUTE_NOTIFICATION_VAPID_PRIVATE_KEY: z.string().optional(),
  ROUTE_NOTIFICATION_VAPID_MAILTO: z.string().optional(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

tryParseEnv(EnvSchema);

// eslint-disable-next-line node/no-process-env
export default EnvSchema.parse(process.env);
