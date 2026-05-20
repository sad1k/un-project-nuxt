import { and, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import slugify from "slug";

import type { InsertLocation, InsertLocationLog } from "../schema";

import db from "..";
import { location, locationLog, locationLogImage } from "../schema";

export async function findLocationByName(
  existing: InsertLocation,
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

export async function findLocationLogForImageSigning(input: {
  id: number;
  slug: string;
  userId: number;
}) {
  const [foundLocationLog] = await db
    .select({ id: locationLog.id })
    .from(locationLog)
    .innerJoin(location, eq(locationLog.locationId, location.id))
    .where(and(
      eq(locationLog.id, input.id),
      eq(locationLog.userId, input.userId),
      eq(location.slug, input.slug),
      eq(location.userId, input.userId),
    ))
    .limit(1);

  return foundLocationLog;
}

export async function insertLocation(
  data: InsertLocation,
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

export async function findOrCreateLocationForRoutePoint(
  userId: number,
  input: {
    name: string;
    description?: string | null;
    lat: number;
    long: number;
  },
) {
  const locationData: InsertLocation = {
    description: input.description?.slice(0, 1000) ?? null,
    lat: input.lat,
    long: input.long,
    name: input.name.slice(0, 100),
  };
  const existingLocation = await findLocationByName(locationData, userId);

  if (existingLocation)
    return existingLocation;

  return insertLocation(locationData, await createUniqueLocationSlug(userId, locationData.name), userId);
}

async function createUniqueLocationSlug(userId: number, name: string) {
  const originalSlug = slugify(name) || "route-stop";
  let slug = originalSlug;
  let existingSlug = !!(await findLocationBySlug(userId, originalSlug));
  const nanoid = customAlphabet("1234567890abcdefghkl", 5);

  while (existingSlug) {
    const idSlug = `${originalSlug}-${nanoid()}`;
    existingSlug = !!(await findLocationBySlug(userId, idSlug));

    if (!existingSlug)
      slug = idSlug;
  }

  return slug;
}

export async function findLocations(userId: number) {
  return db.query.location.findMany({
    where: eq(location.userId, userId),
  });
}

export async function updateLocationBySlug(
  data: InsertLocation,
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
