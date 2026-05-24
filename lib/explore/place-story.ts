import { z } from "zod";

import { PlaceDataSourceSchema } from "~/lib/explore/place-intelligence";

export const PlaceStoryStatusSchema = z.enum(["ready", "available", "unavailable", "generating", "failed"]);

export const PlaceStoryFailureCodeSchema = z.enum([
  "insufficient_place_facts",
  "missing_route_point",
  "missing_tts_api_key",
  "tts_provider_failed",
  "audio_storage_failed",
  "audio_not_found",
  "unexpected_error",
]);

export const PlaceStoryVoiceSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  requirementStatus: z.literal("default_only"),
});

export const PlaceStorySourceSupportSchema = z.object({
  supported: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  signals: z.array(z.object({
    key: z.string().min(1).max(60),
    label: z.string().min(1).max(160),
    source: PlaceDataSourceSchema,
  })).max(8),
  unavailableReason: PlaceStoryFailureCodeSchema.optional(),
});

export const PlaceStoryAudioSchema = z.object({
  url: z.string().min(1),
  contentType: z.string().min(1).max(100),
  byteLength: z.number().int().min(0),
  durationSeconds: z.number().int().min(1).max(600).nullable(),
  generatedAt: z.number().int().positive(),
  cacheKey: z.string().min(1).max(240),
});

export const PlaceStoryRequestSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive(),
  routePointId: z.string().trim().min(1).max(80),
});

export const PlaceStoryResponseSchema = z.object({
  routePointId: z.string().min(1).max(80),
  status: PlaceStoryStatusSchema,
  title: z.string().min(1).max(160),
  sourceNote: z.string().min(1).max(220),
  disclosure: z.string().min(1).max(220),
  voice: PlaceStoryVoiceSchema,
  sourceSupport: PlaceStorySourceSupportSchema,
  audio: PlaceStoryAudioSchema.nullable(),
  failureCode: PlaceStoryFailureCodeSchema.nullable(),
});

export type PlaceStoryStatus = z.infer<typeof PlaceStoryStatusSchema>;
export type PlaceStoryFailureCode = z.infer<typeof PlaceStoryFailureCodeSchema>;
export type PlaceStoryVoice = z.infer<typeof PlaceStoryVoiceSchema>;
export type PlaceStorySourceSupport = z.infer<typeof PlaceStorySourceSupportSchema>;
export type PlaceStoryAudio = z.infer<typeof PlaceStoryAudioSchema>;
export type PlaceStoryRequest = z.infer<typeof PlaceStoryRequestSchema>;
export type PlaceStoryResponse = z.infer<typeof PlaceStoryResponseSchema>;

export const PLACE_STORY_SOURCE_NOTE = "На основе данных из источников и контекста маршрута.";
export const PLACE_STORY_DISCLOSURE = "Аудиорассказ сгенерирован AI.";

export function createDefaultPlaceStoryVoice(voiceId = "coral"): PlaceStoryVoice {
  return {
    id: voiceId,
    label: "Стандартный рассказчик",
    requirementStatus: "default_only",
  };
}

export function createPlaceStoryAudioUrl(input: PlaceStoryRequest) {
  const searchParams = new URLSearchParams({
    routePointId: input.routePointId,
    sessionId: String(input.sessionId),
    variantId: String(input.variantId),
  });

  return `/api/explore/place-story/audio?${searchParams.toString()}`;
}

export function createPlaceStoryCacheKey(input: PlaceStoryRequest) {
  return `place-story:${input.sessionId}:${input.variantId}:${input.routePointId}`;
}

export function createReadyPlaceStoryResponse(input: {
  request: PlaceStoryRequest;
  title: string;
  voiceId?: string;
}): PlaceStoryResponse {
  return PlaceStoryResponseSchema.parse({
    routePointId: input.request.routePointId,
    status: "ready",
    title: input.title,
    sourceNote: PLACE_STORY_SOURCE_NOTE,
    disclosure: PLACE_STORY_DISCLOSURE,
    voice: createDefaultPlaceStoryVoice(input.voiceId),
    sourceSupport: {
      supported: true,
      confidence: "low",
      signals: [],
    },
    audio: null,
    failureCode: null,
  });
}

export function createUnavailablePlaceStoryResponse(input: {
  request: PlaceStoryRequest;
  title: string;
  sourceSupport: PlaceStorySourceSupport;
  voiceId?: string;
}): PlaceStoryResponse {
  return PlaceStoryResponseSchema.parse({
    routePointId: input.request.routePointId,
    status: "unavailable",
    title: input.title,
    sourceNote: "История недоступна, пока не появится больше фактов о месте из источников.",
    disclosure: PLACE_STORY_DISCLOSURE,
    voice: createDefaultPlaceStoryVoice(input.voiceId),
    sourceSupport: input.sourceSupport,
    audio: null,
    failureCode: input.sourceSupport.unavailableReason ?? "insufficient_place_facts",
  });
}
