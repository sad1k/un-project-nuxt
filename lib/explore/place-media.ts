import { z } from "zod";

import type { PlaceDataSource, PlacePhoto } from "~/lib/explore/place-intelligence";

import { findPublicPlacePhotoNear } from "~/lib/db/queries/location-log-image";
import {
  getFreshPlaceMediaCacheEntry,
  recordPlaceMediaCacheFailure,
  upsertPlaceMediaCacheEntry,
} from "~/lib/db/queries/place-media-cache";
import env from "~/lib/env";
import { fetchGooglePlacePhoto, fetchWikimediaPlacePhoto } from "~/lib/explore/place-intelligence-providers";

export const PlaceMediaSourceSchema = z.enum(["app", "google", "wikimedia", "foursquare"]);
export const PlaceMediaFailureCodeSchema = z.enum([
  "app_photo_no_match",
  "provider_not_configured",
  "provider_no_match",
  "provider_unavailable",
  "open_provider_unavailable",
  "cache_unavailable",
]);

export const PlaceMediaResolutionInputSchema = z.object({
  name: z.string().min(1).max(160),
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(1).max(2000).default(250),
});

export const PlaceMediaPhotoSchema = z.object({
  url: z.string().min(1),
  alt: z.string().min(1).max(180),
  source: PlaceMediaSourceSchema,
  attribution: z.string().max(220).optional(),
  providerPlaceId: z.string().max(240).optional(),
  providerPhotoReference: z.string().max(500).optional(),
  licenseHint: z.string().max(160).optional(),
  termsHint: z.string().max(240).optional(),
  expiresAt: z.number().int().positive().optional(),
  matchConfidence: z.enum(["low", "medium", "high"]).default("low"),
});

export const PlaceMediaCacheEntrySchema = PlaceMediaPhotoSchema.extend({
  placeKey: z.string().min(1).max(240),
  failureCode: PlaceMediaFailureCodeSchema.optional(),
  failedAt: z.number().int().positive().optional(),
});

export const PlaceMediaResolutionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("photo"),
    photo: PlaceMediaPhotoSchema,
  }),
  z.object({
    status: z.literal("missing"),
    reason: PlaceMediaFailureCodeSchema,
    source: z.object({
      kind: z.literal("missing"),
      label: z.string().min(1),
      confidence: z.literal("low"),
    }),
  }),
]);

export type PlaceMediaSource = z.infer<typeof PlaceMediaSourceSchema>;
export type PlaceMediaFailureCode = z.infer<typeof PlaceMediaFailureCodeSchema>;
export type PlaceMediaResolutionInput = z.input<typeof PlaceMediaResolutionInputSchema>;
export type PlaceMediaPhoto = z.infer<typeof PlaceMediaPhotoSchema>;
export type PlaceMediaCacheEntry = z.infer<typeof PlaceMediaCacheEntrySchema>;
export type PlaceMediaResolutionResult = z.infer<typeof PlaceMediaResolutionResultSchema>;

type PlaceMediaResolverDeps = {
  findAppPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchGooglePhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchOpenProviderPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  getFreshCacheEntry?: (placeKey: string) => Promise<PlaceMediaCacheEntry | null>;
  upsertCacheEntry?: (entry: PlaceMediaCacheEntry) => Promise<void>;
  recordFailure?: (placeKey: string, failureCode: PlaceMediaFailureCode) => Promise<void>;
};

const SOURCE_LABELS: Record<PlaceMediaSource, string> = {
  app: "WanderLog public photos",
  google: "Google Places",
  wikimedia: "Wikimedia Commons",
  foursquare: "Foursquare",
};

export function createPlaceMediaKey(input: Pick<PlaceMediaResolutionInput, "name" | "lat" | "long">) {
  const normalizedName = input.name.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalizedName}:${input.lat.toFixed(4)}:${input.long.toFixed(4)}`;
}

export async function resolveRealPlacePhoto(
  rawInput: PlaceMediaResolutionInput,
  deps: PlaceMediaResolverDeps = {},
): Promise<PlaceMediaResolutionResult> {
  const input = PlaceMediaResolutionInputSchema.parse(rawInput);
  const placeKey = createPlaceMediaKey(input);
  const logContext = createPlaceMediaLogContext(input);
  const getFreshCacheEntryFn = deps.getFreshCacheEntry ?? safeGetFreshCacheEntry;
  const upsertCacheEntryFn = deps.upsertCacheEntry ?? safeUpsertCacheEntry;
  const recordFailureFn = deps.recordFailure ?? safeRecordFailure;

  logPlaceMediaDebug("resolve_start", logContext);

  const cached = await getFreshCacheEntryFn(placeKey);
  if (cached && !cached.failureCode) {
    logPlaceMediaDebug("cache_hit", { ...logContext, source: cached.source });
    return { status: "photo", photo: cached };
  }
  logPlaceMediaDebug("cache_miss", logContext);

  const resolvers = [
    {
      name: "app_public_photo",
      resolve: deps.findAppPhoto ?? findAppPlacePhoto,
    },
    {
      name: "google_places_photo",
      resolve: deps.fetchGooglePhoto ?? fetchGooglePlaceMediaPhoto,
    },
    {
      name: "open_provider_photo",
      resolve: deps.fetchOpenProviderPhoto ?? fetchUnavailableOpenProviderPhoto,
    },
  ];

  for (const resolver of resolvers) {
    logPlaceMediaDebug(`${resolver.name}_start`, {
      ...logContext,
      source: resolver.name,
    });
    const photo = await resolver.resolve(input);
    if (photo) {
      await upsertCacheEntryFn({ ...photo, placeKey });
      logPlaceMediaDebug(`${resolver.name}_hit`, {
        ...logContext,
        source: photo.source,
        hasAttribution: Boolean(photo.attribution),
      });
      return { status: "photo", photo };
    }
    logPlaceMediaDebug(`${resolver.name}_miss`, logContext);
  }

  await recordFailureFn(placeKey, "provider_no_match");
  logPlaceMediaDebug("resolve_missing", {
    ...logContext,
    reason: "provider_no_match",
  });
  return {
    status: "missing",
    reason: "provider_no_match",
    source: {
      kind: "missing",
      label: "No real place photo available",
      confidence: "low",
    },
  };
}

export function toPlacePhoto(photo: PlaceMediaPhoto, fallbackName: string): PlacePhoto {
  const source: PlaceDataSource = {
    kind: photo.source === "app" ? "app" : "provider",
    label: SOURCE_LABELS[photo.source],
    confidence: photo.matchConfidence,
  };

  return {
    url: photo.url,
    alt: photo.alt || `Photo of ${fallbackName}`,
    attribution: photo.attribution,
    source,
  };
}

async function findAppPlacePhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await findPublicPlacePhotoNear({
    name: input.name,
    lat: input.lat,
    long: input.long,
    radiusMeters: input.radiusMeters,
  });
  if (!photo)
    return null;

  return {
    url: `${env.S3_BUCKET_URL}/${photo.key}`,
    alt: `WanderLog public photo: ${photo.publicPlaceName || input.name}`,
    source: "app",
    attribution: photo.authorName ? `WanderLog: ${photo.authorName}` : "WanderLog public photo",
    licenseHint: "app-owned-public-user-photo",
    termsHint: "Stored in WanderLog S3 because the owner explicitly made this photo public.",
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
  };
}

async function fetchGooglePlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchGooglePlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "google",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "google-places-photo",
    termsHint: "Proxy with fresh server-side photo references and short-lived caching; do not persist copied binaries by default.",
    expiresAt: Date.now() + 60 * 60 * 1000,
    matchConfidence: "medium",
  };
}

async function fetchUnavailableOpenProviderPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchWikimediaPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "wikimedia",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "wikimedia-page-image",
    termsHint: "Wikimedia/Wikipedia page image thumbnail; verify source page license before durable reuse.",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
  };
}

async function safeGetFreshCacheEntry(placeKey: string) {
  try {
    return await getFreshPlaceMediaCacheEntry(placeKey);
  }
  catch {
    return null;
  }
}

async function safeUpsertCacheEntry(entry: PlaceMediaCacheEntry) {
  try {
    await upsertPlaceMediaCacheEntry(entry);
  }
  catch {
    // Cache is opportunistic; provider/app photos should still render without a migrated cache table.
  }
}

async function safeRecordFailure(placeKey: string, failureCode: PlaceMediaFailureCode) {
  try {
    await recordPlaceMediaCacheFailure(placeKey, failureCode);
  }
  catch {
    // Failure telemetry is best-effort and must not break place popups.
  }
}

function createPlaceMediaLogContext(input: Required<PlaceMediaResolutionInput>) {
  return {
    name: input.name,
    lat: Number(input.lat.toFixed(4)),
    long: Number(input.long.toFixed(4)),
    radiusMeters: input.radiusMeters,
  };
}

function logPlaceMediaDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[place-media]", stage, details);
}
