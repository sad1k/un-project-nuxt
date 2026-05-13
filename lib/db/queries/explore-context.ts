import { desc, eq } from "drizzle-orm";

import type { ExplorePersonalContext } from "~/lib/explore/context";

import db from "..";
import { location, locationLog } from "../schema";

type LocationWithLogs = Awaited<ReturnType<typeof findExploreLocationsByUserId>>[number];

export async function findExploreContextByUserId(userId: number): Promise<ExplorePersonalContext> {
  const locations = await findExploreLocationsByUserId(userId);

  return shapeExploreContext(locations);
}

export function shapeExploreContext(locations: LocationWithLogs[]): ExplorePersonalContext {
  return {
    savedPlaces: locations.map(savedLocation => ({
      id: savedLocation.id,
      name: savedLocation.name,
      description: savedLocation.description,
      coordinates: {
        lat: savedLocation.lat,
        long: savedLocation.long,
      },
      logCount: savedLocation.locationLogs.length,
    })),
    diaryLogs: locations.flatMap(savedLocation => savedLocation.locationLogs.map(log => ({
      id: log.id,
      locationId: savedLocation.id,
      name: log.name,
      description: log.description,
      coordinates: {
        lat: log.lat,
        long: log.long,
      },
      startedAt: log.startedAt,
      endedAt: log.endedAt,
    }))),
  };
}

function findExploreLocationsByUserId(userId: number) {
  return db.query.location.findMany({
    limit: 50,
    orderBy: [desc(location.createdAt)],
    where: eq(location.userId, userId),
    with: {
      locationLogs: {
        limit: 5,
        orderBy: [desc(locationLog.startedAt)],
      },
    },
  });
}
