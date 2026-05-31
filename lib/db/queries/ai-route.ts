import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import type { RouteEventEnvelope, RoutePoint } from "~/lib/ai/route-contract";
import type { ExploreRequestContext } from "~/lib/explore/context";

import { ExploreRequestContextSchema } from "~/lib/ai/route-contract";

import db from "..";
import {
  aiRouteEvent,
  aiRouteMessage,
  aiRoutePoint,
  aiRouteSession,
  aiRouteVariant,
  routeDiarySave,
  routePlaceStory,
} from "../schema";

type RouteMessageRole = "user" | "assistant" | "system";
type VariantStatus = "generating" | "completed" | "failed";
type EventValidationStatus = "valid" | "invalid" | "skipped";
type RouteNotificationStatus = "pending" | "delivered" | "failed" | "dismissed";
export type AiRouteFailureStage = "validation" | "provider" | "parsing" | "persistence" | "diary_save" | "notification" | "unknown";

const STALE_GENERATION_MS = 15 * 60 * 1000;

export async function countAiRouteVariantsForUserSince(userId: number, sinceMs: number) {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(aiRouteVariant)
    .where(and(eq(aiRouteVariant.userId, userId), gte(aiRouteVariant.createdAt, sinceMs)));

  return Number(row?.value ?? 0);
}

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
    failureStage?: AiRouteFailureStage;
    failureCode: string;
  },
) {
  const [updatedVariant] = await db
    .update(aiRouteVariant)
    .set({
      generationCompletedAt: Date.now(),
      notificationStatus: "pending" satisfies RouteNotificationStatus,
      status: "failed" satisfies VariantStatus,
      failureStage: input.failureStage ?? resolveAiRouteFailureStage(input.failureCode),
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

export async function deleteAiRouteSessionByIdForUser(userId: number, sessionId: number) {
  const [deletedSession] = await db
    .delete(aiRouteSession)
    .where(and(eq(aiRouteSession.id, sessionId), eq(aiRouteSession.userId, userId)))
    .returning();

  return deletedSession;
}

export async function updateAiRoutePoint(
  userId: number,
  input: {
    variantId: number;
    routePointId: string;
    patch: {
      name?: string;
      day?: number;
      coordinates?: { lat: number; long: number };
      estimatedStart?: string;
      estimatedDurationMinutes?: number;
      rationale?: string;
    };
  },
) {
  const values: Partial<typeof aiRoutePoint.$inferInsert> = {};
  if (input.patch.name !== undefined)
    values.name = input.patch.name;
  if (input.patch.day !== undefined)
    values.day = input.patch.day;
  if (input.patch.coordinates) {
    values.lat = input.patch.coordinates.lat;
    values.long = input.patch.coordinates.long;
  }
  if (input.patch.estimatedStart !== undefined)
    values.estimatedStart = input.patch.estimatedStart;
  if (input.patch.estimatedDurationMinutes !== undefined)
    values.estimatedDurationMinutes = input.patch.estimatedDurationMinutes;
  if (input.patch.rationale !== undefined)
    values.rationale = input.patch.rationale;

  if (Object.keys(values).length === 0)
    return null;

  const [updated] = await db
    .update(aiRoutePoint)
    .set(values)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ))
    .returning();

  return updated ?? null;
}

export async function deleteAiRoutePoint(
  userId: number,
  input: { sessionId: number; variantId: number; routePointId: string },
) {
  const [deleted] = await db
    .delete(aiRoutePoint)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ))
    .returning();

  if (deleted) {
    await db
      .delete(routePlaceStory)
      .where(and(
        eq(routePlaceStory.userId, userId),
        eq(routePlaceStory.sessionId, input.sessionId),
        eq(routePlaceStory.variantId, input.variantId),
        eq(routePlaceStory.routePointId, input.routePointId),
      ));
  }

  return Boolean(deleted);
}

export async function clearAiRouteVariantPoints(
  userId: number,
  input: { sessionId: number; variantId: number },
) {
  const deleted = await db
    .delete(aiRoutePoint)
    .where(and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
    ))
    .returning();

  await db
    .delete(routePlaceStory)
    .where(and(
      eq(routePlaceStory.userId, userId),
      eq(routePlaceStory.sessionId, input.sessionId),
      eq(routePlaceStory.variantId, input.variantId),
    ));

  return deleted.length;
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
        failureStage: activeVariant?.failureStage ?? resolveAiRouteFailureStage(activeVariant?.failureCode ?? null),
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

export async function findAdminAiRouteSessionSummaries(input: {
  failureCode?: string;
  failureStage?: AiRouteFailureStage;
  from?: number;
  limit?: number;
  status?: VariantStatus;
  to?: number;
} = {}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const sessions = await db.query.aiRouteSession.findMany({
    orderBy: [desc(aiRouteSession.updateAt)],
    with: {
      user: {
        columns: {
          email: true,
          id: true,
          name: true,
        },
      },
      variants: {
        orderBy: [desc(aiRouteVariant.updateAt)],
        with: {
          points: true,
        },
      },
    },
  });

  const filteredSessions = sessions
    .filter(session => typeof input.from !== "number" || session.createdAt >= input.from)
    .filter(session => typeof input.to !== "number" || session.createdAt <= input.to);
  const activeVariants = filteredSessions
    .map(session => getActiveAdminVariant(session))
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
  const diarySaveSummaries = await findAdminRouteDiarySaveSummariesByVariantIds(
    activeVariants.map(variant => variant.id),
    new Map(activeVariants.map(variant => [variant.id, variant.points.length])),
  );

  return filteredSessions
    .map((session) => {
      const activeVariant = getActiveAdminVariant(session);
      const diarySave = activeVariant ? diarySaveSummaries.get(activeVariant.id) ?? null : null;
      const diagnostics = createAdminFailureDiagnostics(activeVariant, diarySave?.status ?? null);

      return {
        activeVariantId: session.activeVariantId,
        cityName: session.cityName,
        createdAt: session.createdAt,
        displayStatus: getAdminDisplayStatus(session.status, activeVariant),
        failureCode: activeVariant?.failureCode ?? null,
        failureStage: diagnostics.failureStage,
        generationCompletedAt: activeVariant?.generationCompletedAt ?? null,
        generationHeartbeatAt: activeVariant?.generationHeartbeatAt ?? null,
        generationStartedAt: activeVariant?.generationStartedAt ?? null,
        notificationStatus: activeVariant?.notificationStatus ?? "pending",
        pointCount: activeVariant?.points.length ?? 0,
        provider: null,
        providerModel: null,
        requestSummary: createSanitizedRequestSummary(session.requestContextJson),
        retryability: diagnostics.retryability,
        retryCount: activeVariant?.retryCount ?? 0,
        safeExplanation: diagnostics.safeExplanation,
        sessionId: session.id,
        status: session.status,
        title: activeVariant?.title ?? null,
        updateAt: session.updateAt,
        user: {
          email: session.user.email,
          id: session.user.id,
          name: session.user.name,
        },
        variantId: activeVariant?.id ?? null,
        diarySave,
      };
    })
    .filter(summary => !input.status || summary.status === input.status)
    .filter(summary => !input.failureCode || summary.failureCode === input.failureCode)
    .filter(summary => !input.failureStage || summary.failureStage === input.failureStage)
    .slice(0, limit);
}

export async function findAdminAiRouteSessionDetail(sessionId: number) {
  const session = await db.query.aiRouteSession.findFirst({
    where: eq(aiRouteSession.id, sessionId),
    with: {
      user: {
        columns: {
          email: true,
          id: true,
          name: true,
        },
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

  if (!session)
    return null;

  const variants = session.variants;
  const diarySaveSummaries = await findAdminRouteDiarySaveSummariesByVariantIds(
    variants.map(variant => variant.id),
    new Map(variants.map(variant => [variant.id, variant.points.length])),
  );

  return {
    activeVariantId: session.activeVariantId,
    cityName: session.cityName,
    createdAt: session.createdAt,
    events: session.events.map(event => ({
      createdAt: event.createdAt,
      sequence: event.sequence,
      type: event.type,
      validationStatus: event.validationStatus,
      variantId: event.variantId,
    })),
    requestSummary: createSanitizedRequestSummary(session.requestContextJson),
    sessionId: session.id,
    status: session.status,
    updateAt: session.updateAt,
    user: {
      email: session.user.email,
      id: session.user.id,
      name: session.user.name,
    },
    variants: variants.map((variant) => {
      const diarySave = diarySaveSummaries.get(variant.id) ?? null;
      const diagnostics = createAdminFailureDiagnostics(variant, diarySave?.status ?? null);

      return {
        diarySave,
        failureCode: variant.failureCode,
        failureStage: diagnostics.failureStage,
        generationCompletedAt: variant.generationCompletedAt,
        generationHeartbeatAt: variant.generationHeartbeatAt,
        generationStartedAt: variant.generationStartedAt,
        id: variant.id,
        notificationStatus: variant.notificationStatus,
        parentVariantId: variant.parentVariantId,
        points: variant.points.map(point => ({
          approximateDistanceMeters: point.approximateDistanceMeters,
          confidence: point.confidence,
          coordinates: {
            lat: point.lat,
            long: point.long,
          },
          day: point.day,
          estimatedDurationMinutes: point.estimatedDurationMinutes,
          estimatedPriceLevel: point.estimatedPriceLevel,
          estimatedStart: point.estimatedStart,
          name: point.name,
          priceConfidence: point.priceConfidence,
          priceSource: point.priceSource,
          routePointId: point.routePointId,
          sequence: point.sequence,
        })),
        pointCount: variant.points.length,
        retryability: diagnostics.retryability,
        retryCount: variant.retryCount,
        safeExplanation: diagnostics.safeExplanation,
        status: variant.status,
        summary: variant.summary,
        title: variant.title,
      };
    }),
  };
}

export function resolveAiRouteFailureStage(code: string | null | undefined): AiRouteFailureStage {
  if (!code)
    return "unknown";

  if (code.startsWith("provider_") || code.startsWith("missing_"))
    return "provider";

  if (code.includes("parse") || code.includes("route_points") || code.includes("invalid_route_event"))
    return "parsing";

  if (code.includes("validation") || code.includes("invalid_request"))
    return "validation";

  if (code.includes("diary"))
    return "diary_save";

  if (code.includes("notification") || code.includes("push"))
    return "notification";

  if (code.includes("persist") || code.includes("database"))
    return "persistence";

  return "unknown";
}

function getActiveAdminVariant<TVariant extends { id: number; updateAt: number }>(session: {
  activeVariantId: number | null;
  variants: TVariant[];
}) {
  return session.variants.find(variant => variant.id === session.activeVariantId)
    ?? session.variants[0]
    ?? null;
}

function getAdminDisplayStatus(
  status: string,
  activeVariant: {
    generationHeartbeatAt: number | null;
    status: string;
  } | null,
) {
  if (
    status === "generating"
    && typeof activeVariant?.generationHeartbeatAt === "number"
    && Date.now() - activeVariant.generationHeartbeatAt > STALE_GENERATION_MS
  ) {
    return "stale";
  }

  return status;
}

function createSanitizedRequestSummary(input: string) {
  const context = ExploreRequestContextSchema.safeParse(parseStoredJson(input));

  if (!context.success) {
    return {
      candidatePlaceCount: 0,
      cityName: null,
      currentLocationEnabled: false,
      days: null,
      diaryLogCount: 0,
      interests: [],
      savedPlaceCount: 0,
    };
  }

  return {
    candidatePlaceCount: context.data.candidatePlaces.length,
    cityName: context.data.city?.name ?? null,
    currentLocationEnabled: context.data.currentLocation.enabled,
    days: context.data.selectedDays,
    diaryLogCount: context.data.selectedDiaryLogIds.length,
    interests: context.data.interests,
    savedPlaceCount: context.data.selectedSavedPlaceIds.length,
  };
}

function parseStoredJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  }
  catch {
    return null;
  }
}

function createAdminFailureDiagnostics(
  variant: {
    failureCode: string | null;
    failureStage: AiRouteFailureStage | null;
    status: string;
  } | null,
  diarySaveStatus: string | null,
) {
  const failureStage = diarySaveStatus === "failed"
    ? "diary_save"
    : variant?.failureStage ?? resolveAiRouteFailureStage(variant?.failureCode);
  const failureCode = diarySaveStatus === "failed"
    ? "diary_save_failed"
    : variant?.failureCode ?? null;

  return {
    failureStage,
    retryability: getAdminFailureRetryability(failureStage, failureCode),
    safeExplanation: getAdminFailureExplanation(failureStage, failureCode, variant?.status ?? null),
  };
}

function getAdminFailureRetryability(stage: AiRouteFailureStage, code: string | null) {
  if (!code)
    return "not_applicable";

  if (stage === "provider" && (code === "provider_rate_limited" || code === "provider_unavailable"))
    return "retry_later";

  if (stage === "provider" && (code === "provider_auth_failed" || code === "provider_access_denied"))
    return "operator_action";

  if (stage === "parsing" || stage === "validation")
    return "adjust_generation_contract";

  if (stage === "diary_save" || stage === "notification" || stage === "persistence")
    return "retry_after_fix";

  return "review_required";
}

function getAdminFailureExplanation(stage: AiRouteFailureStage, code: string | null, status: string | null) {
  if (!code && status !== "failed")
    return "Ошибка не записана.";

  if (stage === "provider")
    return "Запрос к провайдеру маршрута не удался или не был авторизован.";

  if (stage === "parsing")
    return "Ответ провайдера не удалось превратить в корректные точки маршрута.";

  if (stage === "validation")
    return "Запрос маршрута или сгенерированное событие не прошло валидацию.";

  if (stage === "diary_save")
    return "Маршрут был сгенерирован, но автоматическое сохранение в дневник не удалось.";

  if (stage === "notification")
    return "Генерация маршрута завершилась, но обработка уведомления о завершении не удалась.";

  if (stage === "persistence")
    return "Сервис не смог надёжно сохранить состояние генерации маршрута.";

  return "Генерация маршрута завершилась ошибкой без категории.";
}

async function findAdminRouteDiarySaveSummariesByVariantIds(
  variantIds: number[],
  expectedPointCounts: Map<number, number>,
) {
  const uniqueVariantIds = [...new Set(variantIds)].filter(Number.isFinite);
  const summaries = new Map<number, {
    expectedPointCount: number;
    failedCount: number;
    pendingCount: number;
    savedCount: number;
    status: "pending" | "saved" | "partial" | "failed";
  }>();

  for (const variantId of uniqueVariantIds) {
    const expectedPointCount = expectedPointCounts.get(variantId) ?? 0;
    summaries.set(variantId, {
      expectedPointCount,
      failedCount: 0,
      pendingCount: expectedPointCount,
      savedCount: 0,
      status: "pending",
    });
  }

  if (!uniqueVariantIds.length)
    return summaries;

  const rows = await db.query.routeDiarySave.findMany({
    where: inArray(routeDiarySave.variantId, uniqueVariantIds),
  });

  for (const row of rows) {
    const summary = summaries.get(row.variantId);
    if (!summary)
      continue;

    if (row.status === "saved")
      summary.savedCount += 1;
    else if (row.status === "failed")
      summary.failedCount += 1;
  }

  for (const [variantId, summary] of summaries.entries()) {
    summary.expectedPointCount = expectedPointCounts.get(variantId) ?? summary.expectedPointCount;
    summary.pendingCount = Math.max(0, summary.expectedPointCount - summary.savedCount - summary.failedCount);
    summary.status = resolveAdminDiarySaveStatus(summary);
    summaries.set(variantId, summary);
  }

  return summaries;
}

function resolveAdminDiarySaveStatus(summary: {
  expectedPointCount: number;
  failedCount: number;
  savedCount: number;
}) {
  if (summary.expectedPointCount > 0 && summary.savedCount >= summary.expectedPointCount)
    return "saved";

  if (summary.failedCount > 0 && summary.savedCount === 0)
    return "failed";

  if (summary.savedCount > 0 || summary.failedCount > 0)
    return "partial";

  return "pending";
}
