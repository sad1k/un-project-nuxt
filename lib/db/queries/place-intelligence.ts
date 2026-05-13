import { and, between, count, gte, sql } from "drizzle-orm";

import type { PlaceCommunitySignal } from "~/lib/explore/place-intelligence";

import db from "..";
import { locationLog } from "../schema";

export async function findCommunityPlaceSignal(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
  recentWindowHours?: number;
}): Promise<PlaceCommunitySignal | null> {
  const recentWindowHours = input.recentWindowHours ?? 3;
  const radiusMeters = input.radiusMeters ?? 250;
  const latDelta = radiusMeters / 111_320;
  const longDelta = radiusMeters / (111_320 * Math.cos(input.lat * Math.PI / 180) || 1);
  const recentThreshold = Date.now() - recentWindowHours * 60 * 60 * 1000;

  const [aggregate] = await db
    .select({
      visitCount: count(locationLog.id),
      recentVisitCount: sql<number>`sum(case when ${locationLog.startedAt} >= ${recentThreshold} then 1 else 0 end)`,
    })
    .from(locationLog)
    .where(and(
      between(locationLog.lat, input.lat - latDelta, input.lat + latDelta),
      between(locationLog.long, input.long - longDelta, input.long + longDelta),
      gte(locationLog.endedAt, 0),
    ));

  const visitCount = Number(aggregate?.visitCount ?? 0);
  const recentVisitCount = Number(aggregate?.recentVisitCount ?? 0);
  if (visitCount < 3) {
    return null;
  }

  const likelyCurrentlyThere = recentVisitCount >= 3 ? true : recentVisitCount === 0 ? false : null;
  const fallbackSource = { confidence: "low" as const };
  const confidence: PlaceCommunitySignal["source"]["confidence"] = visitCount >= 10 ? "medium" : fallbackSource.confidence;

  return {
    visitCount,
    recentVisitCount,
    recentWindowHours,
    likelyCurrentlyThere,
    label: formatCommunityLabel(input.name, visitCount, recentVisitCount, recentWindowHours),
    source: {
      kind: "app",
      label: "Aggregate WanderLog visits",
      confidence,
    },
  };
}

function formatCommunityLabel(
  name: string,
  visitCount: number,
  recentVisitCount: number,
  recentWindowHours: number,
) {
  if (recentVisitCount >= 3)
    return `${name} has recent aggregate activity in the last ${recentWindowHours} hours.`;

  return `${visitCount} aggregate app visits near this stop.`;
}
