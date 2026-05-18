import { and, eq } from "drizzle-orm";

import type { PlaceStoryAudio, PlaceStoryRequest, PlaceStorySourceSupport } from "~/lib/explore/place-story";

import type { SelectAiRoutePoint, SelectAiRouteVariant, SelectRoutePlaceStory } from "../schema";

import db from "..";
import { aiRoutePoint, routePlaceStory } from "../schema";

export type RoutePlaceStoryRoutePoint = SelectAiRoutePoint & {
  variant: SelectAiRouteVariant;
};

export async function findRoutePointForPlaceStory(
  userId: number,
  input: PlaceStoryRequest,
): Promise<RoutePlaceStoryRoutePoint | null> {
  const point = await db.query.aiRoutePoint.findFirst({
    where: and(
      eq(aiRoutePoint.userId, userId),
      eq(aiRoutePoint.variantId, input.variantId),
      eq(aiRoutePoint.routePointId, input.routePointId),
    ),
    with: {
      variant: true,
    },
  });

  if (!point || point.variant.sessionId !== input.sessionId)
    return null;

  return point;
}

export async function findRoutePlaceStory(
  userId: number,
  input: PlaceStoryRequest,
) {
  return db.query.routePlaceStory.findFirst({
    where: and(
      eq(routePlaceStory.userId, userId),
      eq(routePlaceStory.sessionId, input.sessionId),
      eq(routePlaceStory.variantId, input.variantId),
      eq(routePlaceStory.routePointId, input.routePointId),
    ),
  });
}

export async function saveRoutePlaceStoryUnavailable(
  userId: number,
  input: PlaceStoryRequest & {
    title: string;
    sourceNote: string;
    sourceSupport: PlaceStorySourceSupport;
    voiceId: string;
  },
) {
  return upsertRoutePlaceStory(userId, {
    ...input,
    audio: null,
    failureCode: input.sourceSupport.unavailableReason ?? "insufficient_place_facts",
    status: "unavailable",
  });
}

export async function saveRoutePlaceStoryFailed(
  userId: number,
  input: PlaceStoryRequest & {
    failureCode: string;
    title: string;
    sourceNote: string;
    sourceSupport: PlaceStorySourceSupport;
    voiceId: string;
  },
) {
  return upsertRoutePlaceStory(userId, {
    ...input,
    audio: null,
    status: "failed",
  });
}

export async function saveRoutePlaceStoryAudio(
  userId: number,
  input: PlaceStoryRequest & {
    audio: PlaceStoryAudio;
    audioObjectKey: string;
    title: string;
    sourceNote: string;
    sourceSupport: PlaceStorySourceSupport;
    voiceId: string;
  },
) {
  return upsertRoutePlaceStory(userId, {
    ...input,
    failureCode: null,
    status: "available",
  });
}

async function upsertRoutePlaceStory(
  userId: number,
  input: PlaceStoryRequest & {
    audio: PlaceStoryAudio | null;
    audioObjectKey?: string;
    failureCode: string | null;
    status: string;
    title: string;
    sourceNote: string;
    sourceSupport: PlaceStorySourceSupport;
    voiceId: string;
  },
) {
  const existing = await findRoutePlaceStory(userId, input);
  const values = {
    audioByteLength: input.audio?.byteLength ?? null,
    audioContentType: input.audio?.contentType ?? null,
    audioDurationSeconds: input.audio?.durationSeconds ?? null,
    audioObjectKey: input.audioObjectKey ?? null,
    failureCode: input.failureCode,
    generatedAt: input.audio?.generatedAt ?? null,
    sourceNote: input.sourceNote,
    sourceSupportJson: JSON.stringify(input.sourceSupport),
    status: input.status,
    title: input.title,
    voiceId: input.voiceId,
  };

  if (existing) {
    const [updated] = await db
      .update(routePlaceStory)
      .set(values)
      .where(and(eq(routePlaceStory.id, existing.id), eq(routePlaceStory.userId, userId)))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(routePlaceStory)
    .values({
      ...values,
      routePointId: input.routePointId,
      sessionId: input.sessionId,
      userId,
      variantId: input.variantId,
    })
    .returning();

  return created;
}

export function parseRoutePlaceStorySourceSupport(row: SelectRoutePlaceStory): PlaceStorySourceSupport {
  try {
    return JSON.parse(row.sourceSupportJson) as PlaceStorySourceSupport;
  }
  catch {
    return {
      confidence: "low",
      signals: [],
      supported: false,
      unavailableReason: "unexpected_error",
    };
  }
}
