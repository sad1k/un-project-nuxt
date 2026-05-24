import type { RoutePoint } from "~/lib/ai/route-contract";

import {
  ExploreRequestContextSchema,
  RouteEventEnvelopeSchema,
  RoutePointSchema,
} from "~/lib/ai/route-contract";
import { findAiRouteSessionByIdForUser } from "~/lib/db/queries/ai-route";
import { findRouteDiarySaveSummariesByVariantIds } from "~/lib/db/queries/route-diary-save";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

type RouteSessionStatus = "generating" | "completed" | "failed";

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parseSessionId(getRouterParam(event, "session-id"));
  const session = await findAiRouteSessionByIdForUser(event.context.user.id, sessionId);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Сессия маршрута не найдена",
    });
  }

  const diarySaveSummaries = await findRouteDiarySaveSummariesByVariantIds(
    event.context.user.id,
    session.variants.map(variant => variant.id),
    {
      expectedPointCounts: new Map(session.variants.map(variant => [variant.id, variant.points.length])),
    },
  );

  return {
    sessionId: session.id,
    status: normalizeStatus(session.status),
    activeVariantId: session.activeVariantId,
    requestContext: parseRequestContext(session.requestContextJson),
    variants: session.variants.map(variant => ({
      id: variant.id,
      parentVariantId: variant.parentVariantId ?? undefined,
      status: normalizeStatus(variant.status),
      title: variant.title ?? undefined,
      summary: variant.summary ?? undefined,
      failureCode: variant.failureCode ?? undefined,
      failureStage: variant.failureStage ?? undefined,
      generationStartedAt: variant.generationStartedAt ?? undefined,
      generationHeartbeatAt: variant.generationHeartbeatAt ?? undefined,
      generationCompletedAt: variant.generationCompletedAt ?? undefined,
      diarySave: diarySaveSummaries.get(variant.id) ?? undefined,
      notificationStatus: variant.notificationStatus,
      pointCount: variant.points.length,
    })),
    events: session.events
      .map(event => parseRouteEvent(event.payloadJson))
      .filter(event => event !== null),
    pointsByVariantId: Object.fromEntries(
      session.variants.map(variant => [
        variant.id,
        variant.points
          .map(toRoutePoint)
          .filter(point => point !== null),
      ]),
    ),
  };
});

function parseSessionId(input: string | undefined) {
  const sessionId = Number(input);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Некорректный ID сессии маршрута",
    });
  }

  return sessionId;
}

function normalizeStatus(input: string): RouteSessionStatus {
  if (input === "completed" || input === "failed")
    return input;

  return "generating";
}

function parseRequestContext(input: string) {
  const parsed = parseJson(input);
  const context = ExploreRequestContextSchema.safeParse(parsed);
  return context.success ? context.data : null;
}

function parseRouteEvent(input: string) {
  const parsed = parseJson(input);
  const event = RouteEventEnvelopeSchema.safeParse(parsed);
  return event.success ? event.data : null;
}

function toRoutePoint(point: {
  routePointId: string;
  name: string;
  day: number;
  lat: number;
  long: number;
  estimatedStart: string | null;
  estimatedDurationMinutes: number | null;
  rationale: string;
  confidence: string;
  alternativeForPointId: string | null;
  approximateDistanceMeters: number | null;
  estimatedPriceLevel: string | null;
  priceConfidence: string | null;
  priceSource: string | null;
}): RoutePoint | null {
  const parsed = RoutePointSchema.safeParse({
    id: point.routePointId,
    name: point.name,
    day: point.day,
    coordinates: {
      lat: point.lat,
      long: point.long,
    },
    estimatedStart: point.estimatedStart ?? undefined,
    estimatedDurationMinutes: point.estimatedDurationMinutes ?? undefined,
    rationale: point.rationale,
    confidence: point.confidence,
    alternativeForPointId: point.alternativeForPointId ?? undefined,
    approximateDistanceMeters: point.approximateDistanceMeters ?? undefined,
    estimatedPriceLevel: point.estimatedPriceLevel ?? undefined,
    priceConfidence: point.priceConfidence ?? undefined,
    priceSource: point.priceSource ?? undefined,
  });

  return parsed.success ? parsed.data : null;
}

function parseJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  }
  catch {
    return null;
  }
}
