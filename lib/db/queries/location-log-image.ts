import { and, between, desc, eq, gte, isNotNull, lte } from "drizzle-orm";

import db from "..";
import { user } from "../schema/auth";
import {
  type InsertLocationLogImage,
  locationLogImage,
  type publicPhotoLocationSourceValues,
} from "../schema/location-log-image";

export type PublicPhotoLocationSource = typeof publicPhotoLocationSourceValues[number];

export type PublishPlacePhotoInput = {
  publicPlaceName: string;
  publicLat: number;
  publicLong: number;
  locationAccuracy?: number | null;
  locationSource?: PublicPhotoLocationSource | null;
};

export type PublicPlacePhotoBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type PublicPlacePhotoMatch = {
  id: number;
  key: string;
  publicPlaceName: string | null;
  publicLat: number | null;
  publicLong: number | null;
  authorName: string | null;
  matchConfidence: "low" | "medium" | "high";
};

export async function insertLocationLogImage(
  data: InsertLocationLogImage,
  userId: number,
  locationLogId: number,
) {
  const [inserted] = await db.insert(locationLogImage).values({
    ...data,
    userId,
    locationLogId,
  }).returning();

  return inserted;
}

export async function makeLocationLogImagePublic(
  imageId: number,
  userId: number,
  input: PublishPlacePhotoInput,
) {
  const [updated] = await db.update(locationLogImage).set({
    visibility: "public",
    publicPlaceName: input.publicPlaceName,
    publicLat: input.publicLat,
    publicLong: input.publicLong,
    publishedAt: Date.now(),
    moderationStatus: "visible",
    locationAccuracy: input.locationAccuracy ?? null,
    locationSource: input.locationSource ?? null,
  }).where(
    and(eq(locationLogImage.id, imageId), eq(locationLogImage.userId, userId)),
  ).returning();

  return updated;
}

export async function makeLocationLogImagePrivate(imageId: number, userId: number) {
  const [updated] = await db.update(locationLogImage).set({
    visibility: "private",
    publicPlaceName: null,
    publicLat: null,
    publicLong: null,
    publishedAt: null,
    locationAccuracy: null,
    locationSource: null,
  }).where(
    and(eq(locationLogImage.id, imageId), eq(locationLogImage.userId, userId)),
  ).returning();

  return updated;
}

export async function listPublicPlacePhotos(input?: {
  bounds?: PublicPlacePhotoBounds;
  limit?: number;
}) {
  const conditions = [
    eq(locationLogImage.visibility, "public"),
    eq(locationLogImage.moderationStatus, "visible"),
    isNotNull(locationLogImage.publishedAt),
    isNotNull(locationLogImage.publicPlaceName),
    isNotNull(locationLogImage.publicLat),
    isNotNull(locationLogImage.publicLong),
  ];

  if (input?.bounds) {
    conditions.push(
      gte(locationLogImage.publicLat, input.bounds.south),
      lte(locationLogImage.publicLat, input.bounds.north),
      gte(locationLogImage.publicLong, input.bounds.west),
      lte(locationLogImage.publicLong, input.bounds.east),
    );
  }

  return db.select({
    id: locationLogImage.id,
    key: locationLogImage.key,
    publicPlaceName: locationLogImage.publicPlaceName,
    publicLat: locationLogImage.publicLat,
    publicLong: locationLogImage.publicLong,
    publishedAt: locationLogImage.publishedAt,
    locationAccuracy: locationLogImage.locationAccuracy,
    locationSource: locationLogImage.locationSource,
    authorName: user.name,
  })
    .from(locationLogImage)
    .innerJoin(user, eq(locationLogImage.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(locationLogImage.publishedAt))
    .limit(input?.limit ?? 100);
}

export async function findPublicPlacePhotoNear(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
}): Promise<PublicPlacePhotoMatch | null> {
  const radiusMeters = input.radiusMeters ?? 250;
  const latDelta = radiusMeters / 111_320;
  const longDelta = radiusMeters / (111_320 * Math.cos(input.lat * Math.PI / 180) || 1);

  const [photo] = await db.select({
    id: locationLogImage.id,
    key: locationLogImage.key,
    publicPlaceName: locationLogImage.publicPlaceName,
    publicLat: locationLogImage.publicLat,
    publicLong: locationLogImage.publicLong,
    authorName: user.name,
  })
    .from(locationLogImage)
    .innerJoin(user, eq(locationLogImage.userId, user.id))
    .where(and(
      eq(locationLogImage.visibility, "public"),
      eq(locationLogImage.moderationStatus, "visible"),
      isNotNull(locationLogImage.publishedAt),
      isNotNull(locationLogImage.publicPlaceName),
      isNotNull(locationLogImage.publicLat),
      isNotNull(locationLogImage.publicLong),
      between(locationLogImage.publicLat, input.lat - latDelta, input.lat + latDelta),
      between(locationLogImage.publicLong, input.long - longDelta, input.long + longDelta),
    ))
    .orderBy(desc(locationLogImage.publishedAt))
    .limit(1);

  if (!photo)
    return null;

  return {
    ...photo,
    matchConfidence: scorePublicPlacePhotoMatch(input.name, photo.publicPlaceName),
  };
}

function scorePublicPlacePhotoMatch(inputName: string, publicPlaceName: string | null): "low" | "medium" | "high" {
  const normalizedInput = normalizePlaceName(inputName);
  const normalizedPublic = normalizePlaceName(publicPlaceName || "");
  if (!normalizedInput || !normalizedPublic)
    return "low";

  if (normalizedInput === normalizedPublic)
    return "high";

  if (normalizedInput.includes(normalizedPublic) || normalizedPublic.includes(normalizedInput))
    return "medium";

  return "low";
}

function normalizePlaceName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
