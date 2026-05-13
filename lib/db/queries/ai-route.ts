import { and, desc, eq } from "drizzle-orm";

import type { RouteEventEnvelope, RoutePoint } from "~/lib/ai/route-contract";
import type { ExploreRequestContext } from "~/lib/explore/context";

import db from "..";
import {
  aiRouteEvent,
  aiRouteMessage,
  aiRoutePoint,
  aiRouteSession,
  aiRouteVariant,
} from "../schema";

type RouteMessageRole = "user" | "assistant" | "system";
type VariantStatus = "generating" | "completed" | "failed";
type EventValidationStatus = "valid" | "invalid" | "skipped";
type RouteNotificationStatus = "pending" | "delivered" | "failed" | "dismissed";

export async function createAiRouteSession(
  userId: number,
  input: {
    requestContext: ExploreRequestContext;
    status?: "generating" | "completed" | "failed";
  },
) {
  const [createdSession] = await db
    .insert(aiRouteSession)
    .values({
      userId,
      status: input.status ?? "generating",
      cityName: input.requestContext.city?.name,
      cityProviderId: input.requestContext.city?.providerId ?? input.requestContext.city?.id,
      requestContextJson: JSON.stringify(input.requestContext),
    })
    .returning();

  return createdSession;
}

export async function appendAiRouteMessage(
  userId: number,
  input: {
    sessionId: number;
    role: RouteMessageRole;
    summary: string;
  },
) {
  const [createdMessage] = await db
    .insert(aiRouteMessage)
    .values({
      userId,
      sessionId: input.sessionId,
      role: input.role,
      summary: input.summary.slice(0, 1000),
    })
    .returning();

  return createdMessage;
}

export async function createAiRouteVariant(
  userId: number,
  input: {
    sessionId: number;
    parentVariantId?: number;
    title?: string;
    summary?: string;
  },
) {
  const [createdVariant] = await db
    .insert(aiRouteVariant)
    .values({
      userId,
      sessionId: input.sessionId,
      parentVariantId: input.parentVariantId,
      title: input.title,
      summary: input.summary,
      status: "generating",
      generationStartedAt: Date.now(),
      generationHeartbeatAt: Date.now(),
      notificationStatus: "pending",
    })
    .returning();

  if (createdVariant) {
    await db
      .update(aiRouteSession)
      .set({ activeVariantId: createdVariant.id })
      .where(and(eq(aiRouteSession.id, input.sessionId), eq(aiRouteSession.userId, userId)));
  }

  return createdVariant;
}

export async function claimAiRouteGenerationRun(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
    runnerId: string;
  },
) {
  const now = Date.now();
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({
      generationHeartbeatAt: now,
      generationStartedAt: now,
      runnerId: input.runnerId,
      status: "generating" satisfies VariantStatus,
    })
    .where(and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ))
    .returning();

  await db
    .update(aiRouteSession)
    .set({ status: "generating" })
    .where(and(eq(aiRouteSession.id, input.sessionId), eq(aiRouteSession.userId, userId)));

  return updatedVariant;
}

export async function refreshAiRouteGenerationHeartbeat(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
  },
) {
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({ generationHeartbeatAt: Date.now() })
    .where(and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ))
    .returning();

  return updatedVariant;
}

export async function persistAiRoutePoint(
  userId: number,
  input: {
    variantId: number;
    sequence: number;
    point: RoutePoint;
    sourceMetadata?: Record<string, unknown>;
  },
) {
  const [createdPoint] = await db
    .insert(aiRoutePoint)
    .values({
      userId,
      variantId: input.variantId,
      sequence: input.sequence,
      routePointId: input.point.id,
      day: input.point.day,
      name: input.point.name,
      lat: input.point.coordinates.lat,
      long: input.point.coordinates.long,
      estimatedStart: input.point.estimatedStart,
      estimatedDurationMinutes: input.point.estimatedDurationMinutes,
      rationale: input.point.rationale,
      confidence: input.point.confidence,
      alternativeForPointId: input.point.alternativeForPointId,
      approximateDistanceMeters: input.point.approximateDistanceMeters,
      estimatedPriceLevel: input.point.estimatedPriceLevel,
      priceConfidence: input.point.priceConfidence,
      priceSource: input.point.priceSource,
      sourceMetadataJson: input.sourceMetadata ? JSON.stringify(input.sourceMetadata) : undefined,
    })
    .returning();

  return createdPoint;
}

export async function persistAiRouteEvent(
  userId: number,
  input: {
    sessionId: number;
    variantId?: number;
    sequence: number;
    event: RouteEventEnvelope;
    validationStatus?: EventValidationStatus;
  },
) {
  const [createdEvent] = await db
    .insert(aiRouteEvent)
    .values({
      userId,
      sessionId: input.sessionId,
      variantId: input.variantId ?? input.event.variantId,
      sequence: input.sequence,
      type: input.event.type,
      payloadJson: JSON.stringify(input.event),
      validationStatus: input.validationStatus ?? "valid",
    })
    .returning();

  return createdEvent;
}

export async function markAiRouteVariantCompleted(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
    title?: string;
    summary?: string;
  },
) {
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({
      generationCompletedAt: Date.now(),
      notificationStatus: "pending" satisfies RouteNotificationStatus,
      status: "completed" satisfies VariantStatus,
      title: input.title,
      summary: input.summary,
    })
    .where(and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ))
    .returning();

  await db
    .update(aiRouteSession)
    .set({
      status: "completed",
      activeVariantId: input.variantId,
    })
    .where(and(eq(aiRouteSession.id, input.sessionId), eq(aiRouteSession.userId, userId)));

  return updatedVariant;
}

export async function markAiRouteVariantFailed(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
    failureCode: string;
  },
) {
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({
      generationCompletedAt: Date.now(),
      notificationStatus: "pending" satisfies RouteNotificationStatus,
      status: "failed" satisfies VariantStatus,
      failureCode: input.failureCode.slice(0, 80),
    })
    .where(and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ))
    .returning();

  await db
    .update(aiRouteSession)
    .set({ status: "failed" })
    .where(and(eq(aiRouteSession.id, input.sessionId), eq(aiRouteSession.userId, userId)));

  return updatedVariant;
}

export async function markAiRouteNotificationStatus(
  userId: number,
  input: {
    sessionId: number;
    variantId: number;
    notificationStatus: RouteNotificationStatus;
  },
) {
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({ notificationStatus: input.notificationStatus })
    .where(and(
      eq(aiRouteVariant.id, input.variantId),
      eq(aiRouteVariant.sessionId, input.sessionId),
      eq(aiRouteVariant.userId, userId),
    ))
    .returning();

  return updatedVariant;
}

export async function findAiRouteSessionsByUserId(userId: number) {
  return db.query.aiRouteSession.findMany({
    where: eq(aiRouteSession.userId, userId),
    orderBy: [desc(aiRouteSession.updateAt)],
    with: {
      variants: {
        orderBy: [desc(aiRouteVariant.updateAt)],
        with: {
          points: {
            orderBy: [aiRoutePoint.day, aiRoutePoint.sequence],
          },
        },
      },
    },
  });
}

export async function findAiRouteSessionByIdForUser(userId: number, sessionId: number) {
  return db.query.aiRouteSession.findFirst({
    where: and(eq(aiRouteSession.id, sessionId), eq(aiRouteSession.userId, userId)),
    with: {
      messages: {
        orderBy: [aiRouteMessage.createdAt],
      },
      variants: {
        orderBy: [desc(aiRouteVariant.updateAt)],
        with: {
          points: {
            orderBy: [aiRoutePoint.day, aiRoutePoint.sequence],
          },
        },
      },
      events: {
        orderBy: [aiRouteEvent.sequence],
      },
    },
  });
}

export async function findAiRouteSessionSummariesByUserId(
  userId: number,
  input: {
    activeOnly?: boolean;
  } = {},
) {
  const sessions = await db.query.aiRouteSession.findMany({
    where: eq(aiRouteSession.userId, userId),
    orderBy: [desc(aiRouteSession.updateAt)],
    with: {
      variants: {
        orderBy: [desc(aiRouteVariant.updateAt)],
        with: {
          points: true,
        },
      },
    },
  });

  return sessions
    .map((session) => {
      const activeVariant = session.variants.find(variant => variant.id === session.activeVariantId)
        ?? session.variants[0]
        ?? null;

      return {
        activeVariantId: session.activeVariantId,
        cityName: session.cityName,
        createdAt: session.createdAt,
        failureCode: activeVariant?.failureCode ?? null,
        generationCompletedAt: activeVariant?.generationCompletedAt ?? null,
        generationHeartbeatAt: activeVariant?.generationHeartbeatAt ?? null,
        generationStartedAt: activeVariant?.generationStartedAt ?? null,
        notificationStatus: activeVariant?.notificationStatus ?? "pending",
        pointCount: activeVariant?.points.length ?? 0,
        retryCount: activeVariant?.retryCount ?? 0,
        sessionId: session.id,
        status: session.status,
        summary: activeVariant?.summary ?? null,
        title: activeVariant?.title ?? null,
        updateAt: session.updateAt,
        variantId: activeVariant?.id ?? null,
      };
    })
    .filter(summary => !input.activeOnly || summary.status === "generating");
}

export async function findAiRoutePointForPlaceIntelligence(
  userId: number,
  input: {
    variantId: number;
    routePointId: string;
  },
) {
  return db.query.aiRoutePoint.findFirst({
    where: and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ),
  });
}
