import db from "..";
import { type InsertLocationLogImage, locationLogImage } from "../schema/location-log-image";

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
