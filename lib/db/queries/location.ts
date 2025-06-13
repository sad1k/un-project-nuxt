import { and, eq } from "drizzle-orm";

import type { InsertLocation } from "../schema";

import db from "..";
import { location } from "../schema";

export async function findLocationByName(existing: InsertLocation, userId: number) {
  return db.query.location.findFirst({
    where: and(eq(location.name, existing.name), eq(location.userId, userId),
    ),
  });
}

export async function findLocationBySlug(originalSlug: string) {
  return db.query.location.findFirst({
    where: eq(location.slug, originalSlug),
  });
}

export async function insertLocation(data: InsertLocation, slug: string, userId: number) {
  const [createdLocation] = await db.insert(location).values({
    ...data,
    slug,
    userId,
  }).returning();
  return createdLocation;
}

export async function findLocations(userId: number) {
  return db.query.location.findMany({
    where: eq(location.userId, userId),
  });
}
