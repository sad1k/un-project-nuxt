import { and, desc, eq } from "drizzle-orm";

import type { InsertLocationLog, InsertLocationSchema } from "../schema";

import db from "..";
import { location, locationLog, locationLogImage } from "../schema";

export async function findLocationByName(
  existing: InsertLocationSchema,
  userId: number,
) {
  return db.query.location.findFirst({
    where: and(eq(location.name, existing.name), eq(location.userId, userId)),
    with: {
      locationLogs: {
        orderBy: [desc(locationLog.startedAt)],
      },
    },
  });
}

export async function findLocationBySlug(userId: number, originalSlug: string) {
  return db.query.location.findFirst({
    where: and(eq(location.slug, originalSlug), eq(location.userId, userId)),
    with: {
      locationLogs: true,
    },
  });
}

export async function findLocationLogById(id: number, userId: number) {
  return db.query.locationLog.findFirst({
    where: and(eq(locationLog.id, id), eq(locationLog.userId, userId)),
    with: {
      images: {
        orderBy: [desc(locationLogImage.createdAt)],
      },
    },
  });
}

export async function insertLocation(
  data: InsertLocationSchema,
  slug: string,
  userId: number,
) {
  const [createdLocation] = await db
    .insert(location)
    .values({
      ...data,
      slug,
      userId,
    })
    .returning();
  return createdLocation;
}

export async function findLocations(userId: number) {
  return db.query.location.findMany({
    where: eq(location.userId, userId),
  });
}

export async function updateLocationBySlug(
  data: InsertLocationSchema,
  slug: string,
  userId: number,
) {
  const [updatedLocation] = await db
    .update(location)
    .set(data)
    .where(and(eq(location.slug, slug), eq(location.userId, userId)))
    .returning();

  return updatedLocation;
}

export async function deleteLocationBySlug(slug: string, userId: number) {
  const [deletedLocation] = await db
    .delete(location)
    .where(and(eq(location.slug, slug), eq(location.userId, userId)))
    .returning();

  return deletedLocation;
}

export async function updateLocationLogById(
  data: InsertLocationLog,
  id: number,
  userId: number,
) {
  const [updatedLocationLog] = await db
    .update(locationLog)
    .set(data)
    .where(and(eq(locationLog.id, id), eq(locationLog.userId, userId)))
    .returning();
  return updatedLocationLog;
}

export async function deleteLocationLogById(id: number, userId: number) {
  const [deletedLocationLog] = await db
    .delete(locationLog)
    .where(and(eq(locationLog.id, id), eq(locationLog.userId, userId)))
    .returning();
  return deletedLocationLog;
}

export async function deleteLocationLogImageById(imageId: number, userId: number) {
  const [deletedLocationLogImage] = await db
    .delete(locationLogImage)
    .where(
      and(eq(locationLogImage.id, imageId), eq(locationLogImage.userId, userId)),
    )
    .returning();
  return deletedLocationLogImage;
}
