import { eq, gt } from "drizzle-orm";

import type { PlaceMediaCacheEntry, PlaceMediaFailureCode } from "~/lib/explore/place-media";

import db from "..";
import { placeMediaCache } from "../schema";

export async function getFreshPlaceMediaCacheEntry(placeKey: string): Promise<PlaceMediaCacheEntry | null> {
  const [entry] = await db.select()
    .from(placeMediaCache)
    .where(eq(placeMediaCache.placeKey, placeKey))
    .limit(1);

  if (!entry)
    return null;

  if (entry.failureCode || !entry.photoUrl || !entry.source || !entry.expiresAt || entry.expiresAt <= Date.now())
    return null;

  return {
    placeKey: entry.placeKey,
    url: entry.photoUrl,
    alt: entry.alt || "Place photo",
    source: entry.source,
    attribution: entry.attribution ?? undefined,
    providerPlaceId: entry.providerPlaceId ?? undefined,
    providerPhotoReference: entry.providerPhotoReference ?? undefined,
    licenseHint: entry.licenseHint ?? undefined,
    termsHint: entry.termsHint ?? undefined,
    expiresAt: entry.expiresAt,
    matchConfidence: entry.matchConfidence,
  };
}

export async function upsertPlaceMediaCacheEntry(entry: PlaceMediaCacheEntry) {
  await db.insert(placeMediaCache).values({
    placeKey: entry.placeKey,
    source: entry.source,
    providerPlaceId: entry.providerPlaceId ?? null,
    providerPhotoReference: entry.providerPhotoReference ?? null,
    photoUrl: entry.url,
    alt: entry.alt,
    attribution: entry.attribution ?? null,
    licenseHint: entry.licenseHint ?? null,
    termsHint: entry.termsHint ?? null,
    expiresAt: entry.expiresAt ?? Date.now() + 60 * 60 * 1000,
    failedAt: null,
    failureCode: null,
    matchConfidence: entry.matchConfidence,
  }).onConflictDoUpdate({
    target: placeMediaCache.placeKey,
    set: {
      source: entry.source,
      providerPlaceId: entry.providerPlaceId ?? null,
      providerPhotoReference: entry.providerPhotoReference ?? null,
      photoUrl: entry.url,
      alt: entry.alt,
      attribution: entry.attribution ?? null,
      licenseHint: entry.licenseHint ?? null,
      termsHint: entry.termsHint ?? null,
      expiresAt: entry.expiresAt ?? Date.now() + 60 * 60 * 1000,
      failedAt: null,
      failureCode: null,
      matchConfidence: entry.matchConfidence,
      updateAt: Date.now(),
    },
  });
}

export async function recordPlaceMediaCacheFailure(placeKey: string, failureCode: PlaceMediaFailureCode) {
  await db.insert(placeMediaCache).values({
    placeKey,
    failedAt: Date.now(),
    failureCode,
    expiresAt: Date.now() + 15 * 60 * 1000,
  }).onConflictDoUpdate({
    target: placeMediaCache.placeKey,
    set: {
      photoUrl: null,
      alt: null,
      providerPhotoReference: null,
      failedAt: Date.now(),
      failureCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
      updateAt: Date.now(),
    },
  });
}

export async function markPlaceMediaCacheStale(placeKey: string) {
  await db.update(placeMediaCache)
    .set({
      expiresAt: Date.now() - 1,
      updateAt: Date.now(),
    })
    .where(eq(placeMediaCache.placeKey, placeKey));
}

export async function listFreshPlaceMediaCacheEntries() {
  return db.select()
    .from(placeMediaCache)
    .where(gt(placeMediaCache.expiresAt, Date.now()));
}
