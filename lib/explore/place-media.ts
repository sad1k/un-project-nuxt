import { z } from "zod";

import type { PlaceDataSource, PlacePhoto } from "~/lib/explore/place-intelligence";

import { findPublicPlacePhotoNear } from "~/lib/db/queries/location-log-image";
import {
  getFreshPlaceMediaCacheEntry,
  recordPlaceMediaCacheFailure,
  upsertPlaceMediaCacheEntry,
} from "~/lib/db/queries/place-media-cache";
import env from "~/lib/env";
import { fetchFlickrPlacePhoto, fetchGooglePlacePhoto, fetchMapillaryPlacePhoto, fetchTripAdvisorPlacePhoto, fetchWikidataPlacePhoto, fetchWikimapiaPlacePhoto, fetchWikimediaPlacePhoto } from "~/lib/explore/place-intelligence-providers";

export const PlaceMediaSourceSchema = z.enum(["app", "google", "wikimedia", "wikidata", "wikimapia", "flickr", "tripadvisor", "mapillary", "foursquare"]);
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
  // Extra photos for the carousel (hero at [0]); reused from one multi-photo provider response.
  gallery: z.array(z.string().min(1)).max(5).optional(),
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
  fetchWikidataPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchWikimapiaPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchFlickrPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchTripAdvisorPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  fetchMapillaryPhoto?: (input: Required<PlaceMediaResolutionInput>) => Promise<PlaceMediaPhoto | null>;
  getFreshCacheEntry?: (placeKey: string) => Promise<PlaceMediaCacheEntry | null>;
  upsertCacheEntry?: (entry: PlaceMediaCacheEntry) => Promise<void>;
  recordFailure?: (placeKey: string, failureCode: PlaceMediaFailureCode) => Promise<void>;
};

const SOURCE_LABELS: Record<PlaceMediaSource, string> = {
  app: "WanderLog public photos",
  google: "Google Places",
  wikimedia: "Wikimedia Commons",
  wikidata: "Wikidata",
  wikimapia: "Wikimapia",
  flickr: "Flickr",
  tripadvisor: "Tripadvisor",
  mapillary: "Mapillary",
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

  // Order = preference. App-owned public photos lead (the user's own, most relevant, free), then
  // TripAdvisor first by request — its traveller venue photos are the richest source for this
  // travel app (restaurants/hotels/attractions). TripAdvisor is the paid provider, but the billing
  // quota (TRIPADVISOR_DAILY_LIMIT/MONTHLY) hard-caps it inside the free tier and it's skipped once
  // the cap is hit. When TripAdvisor has no match (or is capped/unconfigured) the lookup falls
  // through to the free chain: curated Wikidata P18, Wikimedia Commons, Wikimapia, Flickr, then the
  // Mapillary street-level fallback, and paid Google last. Each provider is skipped entirely when
  // its key/token is missing (Wikidata needs none).
  const resolvers = [
    {
      name: "app_public_photo",
      resolve: deps.findAppPhoto ?? findAppPlacePhoto,
    },
    {
      name: "tripadvisor_photo",
      resolve: deps.fetchTripAdvisorPhoto ?? fetchTripAdvisorPlaceMediaPhoto,
    },
    {
      name: "wikidata_photo",
      resolve: deps.fetchWikidataPhoto ?? fetchWikidataPlaceMediaPhoto,
    },
    {
      name: "open_provider_photo",
      resolve: deps.fetchOpenProviderPhoto ?? fetchUnavailableOpenProviderPhoto,
    },
    {
      name: "wikimapia_photo",
      resolve: deps.fetchWikimapiaPhoto ?? fetchWikimapiaPlaceMediaPhoto,
    },
    {
      name: "flickr_photo",
      resolve: deps.fetchFlickrPhoto ?? fetchFlickrPlaceMediaPhoto,
    },
    {
      name: "mapillary_photo",
      resolve: deps.fetchMapillaryPhoto ?? fetchMapillaryPlaceMediaPhoto,
    },
    {
      name: "google_places_photo",
      resolve: deps.fetchGooglePhoto ?? fetchGooglePlaceMediaPhoto,
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
    gallery: photo.gallery,
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

async function fetchWikidataPlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchWikidataPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "wikidata",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "wikidata-p18-commons-image",
    // P18 is the entity's curated lead image on Commons (stable URL); verify the file's own
    // license before durable reuse, same as any Commons media.
    termsHint: "Wikidata P18 image via Wikimedia Commons; curated depiction, verify the file's license before durable reuse.",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
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

async function fetchWikimapiaPlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchWikimapiaPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "wikimapia",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "wikimapia-user-photo-cc-by-sa",
    // CC BY-SA: must credit Wikimapia and link back to wikimapia.org. URLs are stable CDN paths
    // (not signed), so a day-long cache is fine; the data itself can be stale.
    termsHint: "Wikimapia user photo (CC BY-SA); keep attribution and a link back to wikimapia.org. Data can be stale.",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
  };
}

async function fetchTripAdvisorPlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchTripAdvisorPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "tripadvisor",
    gallery: photo.gallery,
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "tripadvisor-content-api-photo",
    // TripAdvisor's display requirements: show their attribution/logo and link back, and don't
    // persist the binary beyond their caching window.
    termsHint: "TripAdvisor Content API photo; show the TripAdvisor attribution and link back per their display requirements.",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
  };
}

async function fetchFlickrPlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchFlickrPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "flickr",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "flickr-cc-licensed-photo",
    // Static Flickr URLs are stable; the CC/PD licence still requires crediting the author and
    // linking back to the Flickr photo page per Flickr's API terms.
    termsHint: "Flickr CC/PD-licensed photo; keep attribution and link back to the Flickr photo page.",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    matchConfidence: photo.matchConfidence,
  };
}

async function fetchMapillaryPlaceMediaPhoto(input: Required<PlaceMediaResolutionInput>): Promise<PlaceMediaPhoto | null> {
  const photo = await fetchMapillaryPlacePhoto(input);
  if (!photo)
    return null;

  return {
    url: photo.url,
    alt: photo.alt,
    source: "mapillary",
    attribution: photo.attribution,
    providerPhotoReference: photo.providerPhotoReference,
    providerPlaceId: photo.providerPlaceId,
    licenseHint: "mapillary-street-level-cc-by-sa",
    // Mapillary thumb URLs are time-limited signed CDN links, so cache briefly (matching the
    // Google expiry) to avoid serving an expired link, and always keep the CC-BY-SA credit.
    termsHint: "Mapillary street-level imagery (CC BY-SA 4.0); thumb URLs are short-lived, keep attribution and do not persist binaries.",
    expiresAt: Date.now() + 60 * 60 * 1000,
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
