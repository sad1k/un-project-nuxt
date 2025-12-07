import db from "..";
import { type InsertLocationLog, locationLog } from "../schema";

export async function insertLocationLog(
  data: InsertLocationLog,
  locationId: number,
  userId: number,
) {
  const [inserted] = await db.insert(locationLog).values({
    ...data,
    locationId,
    userId,
  }).returning();

  return inserted;
}
