import { and, eq, inArray } from "drizzle-orm";

import type { SelectAiRoutePoint, SelectAiRouteVariant, SelectRouteDiarySave } from "../schema";

import db from "..";
import { aiRoutePoint, aiRouteVariant, routeDiarySave } from "../schema";
import { findOrCreateLocationForRoutePoint } from "./location";
import { insertLocationLog } from "./location-log";

type DiarySaveStatus = "pending" | "saved" | "partial" | "failed";

export type RouteDiarySaveSummary = {
  expectedPointCount: number;
  failedCount: number;
  locationLogIds: number[];
  pendingCount: number;
  savedCount: number;
  status: DiarySaveStatus;
};

export async function saveCompletedRouteToDiary(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
  },
) {
  const variant = await db.query.aiRouteVariant.findFirst({
    where: and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ),
    with: {
      points: {
        orderBy: [aiRoutePoint.day, aiRoutePoint.sequence],
      },
    },
  });

  if (!variant || variant.status !== "completed") {
    return createEmptyDiarySaveSummary();
  }

  for (const point of variant.points) {
    await saveRoutePointToDiary(userId, variant, point);
  }

  const summaries = await findRouteDiarySaveSummariesByVariantIds(userId, [input.variantId], {
    expectedPointCounts: new Map([[input.variantId, variant.points.length]]),
  });

  return summaries.get(input.variantId) ?? createEmptyDiarySaveSummary(variant.points.length);
}

export async function findRouteDiarySaveSummariesByVariantIds(
  userId: number,
  variantIds: number[],
  input: {
    expectedPointCounts?: Map<number, number>;
  } = {},
) {
  const uniqueVariantIds = [...new Set(variantIds)].filter(Number.isFinite);
  const summaries = new Map<number, RouteDiarySaveSummary>();

  for (const variantId of uniqueVariantIds) {
    summaries.set(variantId, createEmptyDiarySaveSummary(input.expectedPointCounts?.get(variantId) ?? 0));
  }

  if (!uniqueVariantIds.length)
    return summaries;

  const rows = await db.query.routeDiarySave.findMany({
    where: and(
      eq(routeDiarySave.userId, userId),
      inArray(routeDiarySave.variantId, uniqueVariantIds),
    ),
  });

  for (const row of rows) {
    const summary = summaries.get(row.variantId) ?? createEmptyDiarySaveSummary();
    applyDiarySaveRow(summary, row);
    summaries.set(row.variantId, summary);
  }

  for (const [variantId, summary] of summaries.entries()) {
    const expectedPointCount = input.expectedPointCounts?.get(variantId) ?? summary.expectedPointCount;
    summary.expectedPointCount = expectedPointCount;
    summary.pendingCount = Math.max(0, expectedPointCount - summary.savedCount - summary.failedCount);
    summary.status = resolveDiarySaveStatus(summary);
  }

  return summaries;
}

async function saveRoutePointToDiary(
  userId: number,
  variant: SelectAiRouteVariant & { points: SelectAiRoutePoint[] },
  point: SelectAiRoutePoint,
) {
  const [reservation] = await db
    .insert(routeDiarySave)
    .values({
      routePointId: point.routePointId,
      sessionId: variant.sessionId,
      status: "pending",
      userId,
      variantId: variant.id,
    })
    .onConflictDoNothing()
    .returning();

  if (!reservation)
    return;

  try {
    const diaryLocation = await findOrCreateLocationForRoutePoint(userId, {
      description: point.rationale,
      lat: point.lat,
      long: point.long,
      name: point.name,
    });
    const diaryLog = await insertLocationLog(createLocationLogData(variant, point), diaryLocation.id, userId);

    await db
      .update(routeDiarySave)
      .set({
        failureCode: null,
        locationId: diaryLocation.id,
        locationLogId: diaryLog.id,
        status: "saved",
      })
      .where(and(eq(routeDiarySave.id, reservation.id), eq(routeDiarySave.userId, userId)));
  }
  catch (error) {
    await db
      .update(routeDiarySave)
      .set({
        failureCode: getDiarySaveFailureCode(error),
        status: "failed",
      })
      .where(and(eq(routeDiarySave.id, reservation.id), eq(routeDiarySave.userId, userId)));
  }
}

function createLocationLogData(variant: SelectAiRouteVariant, point: SelectAiRoutePoint) {
  const startedAt = getRoutePointStartTime(variant, point);
  const durationMinutes = point.estimatedDurationMinutes && point.estimatedDurationMinutes > 0
    ? point.estimatedDurationMinutes
    : 90;

  return {
    description: createRoutePointDescription(variant, point),
    endedAt: startedAt + durationMinutes * 60 * 1000,
    lat: point.lat,
    long: point.long,
    name: point.name.slice(0, 100),
    startedAt,
  };
}

function createRoutePointDescription(variant: SelectAiRouteVariant, point: SelectAiRoutePoint) {
  return [
    variant.title ? `Route: ${variant.title}` : "AI generated route stop.",
    variant.summary,
    point.rationale,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 1000);
}

function getRoutePointStartTime(variant: SelectAiRouteVariant, point: SelectAiRoutePoint) {
  const completedAt = variant.generationCompletedAt ?? Date.now();
  const dayOffset = Math.max(0, point.day - 1) * 24 * 60 * 60 * 1000;
  const minutesOffset = parseEstimatedStartMinutes(point.estimatedStart) ?? point.sequence * 90;

  return completedAt + dayOffset + minutesOffset * 60 * 1000;
}

function parseEstimatedStartMinutes(input: string | null) {
  if (!input)
    return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(input.trim());

  if (!match)
    return null;

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes))
    return null;

  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, minutes));
}

function createEmptyDiarySaveSummary(expectedPointCount = 0): RouteDiarySaveSummary {
  return {
    expectedPointCount,
    failedCount: 0,
    locationLogIds: [],
    pendingCount: expectedPointCount,
    savedCount: 0,
    status: expectedPointCount ? "pending" : "pending",
  };
}

function applyDiarySaveRow(summary: RouteDiarySaveSummary, row: SelectRouteDiarySave) {
  if (row.status === "saved") {
    summary.savedCount += 1;

    if (row.locationLogId)
      summary.locationLogIds.push(row.locationLogId);

    return;
  }

  if (row.status === "failed") {
    summary.failedCount += 1;
    return;
  }

  summary.pendingCount += 1;
}

function resolveDiarySaveStatus(summary: RouteDiarySaveSummary): DiarySaveStatus {
  if (summary.expectedPointCount > 0 && summary.savedCount >= summary.expectedPointCount)
    return "saved";

  if (summary.failedCount > 0 && summary.savedCount === 0)
    return "failed";

  if (summary.savedCount > 0 || summary.failedCount > 0)
    return "partial";

  return "pending";
}

function getDiarySaveFailureCode(error: unknown) {
  if (error instanceof Error && error.message.includes("UNIQUE"))
    return "diary_save_conflict";

  return "diary_save_failed";
}
