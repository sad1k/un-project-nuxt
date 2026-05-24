import {
  findRoutePlaceStory,
  findRoutePointForPlaceStory,
  parseRoutePlaceStorySourceSupport,
  saveRoutePlaceStoryAudio,
  saveRoutePlaceStoryFailed,
  saveRoutePlaceStoryUnavailable,
} from "~/lib/db/queries/route-place-story";
import env from "~/lib/env";
import {
  createUnavailablePlaceStoryResponse,
  PLACE_STORY_DISCLOSURE,
  PLACE_STORY_SOURCE_NOTE,
  PlaceStoryRequestSchema,
  PlaceStoryResponseSchema,
} from "~/lib/explore/place-story";
import {
  createAvailableAudioMetadata,
  createPlaceStoryAudioObjectKey,
  evaluatePlaceStorySupport,
  generatePlaceStoryAudio,
  PlaceStoryProviderError,
  savePlaceStoryAudioObject,
} from "~/lib/explore/place-story-provider";
import { buildPlaceIntelligenceForStory } from "~/lib/explore/place-story-provider";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, PlaceStoryRequestSchema.safeParse);
  if (!body.success) {
    throw createError({
      statusCode: 422,
      statusMessage: "Некорректный запрос истории места",
    });
  }

  const request = body.data;
  const routePoint = await findRoutePointForPlaceStory(event.context.user.id, request);
  if (!routePoint) {
    throw createError({
      statusCode: 404,
      statusMessage: "Точка маршрута не найдена",
    });
  }

  const existing = await findRoutePlaceStory(event.context.user.id, request);
  if (existing?.audioObjectKey) {
    return PlaceStoryResponseSchema.parse({
      audio: createAvailableAudioMetadata({
        byteLength: existing.audioByteLength ?? 0,
        contentType: existing.audioContentType ?? "audio/mpeg",
        generatedAt: existing.generatedAt,
        request,
      }),
      disclosure: PLACE_STORY_DISCLOSURE,
      failureCode: null,
      routePointId: request.routePointId,
      sourceNote: existing.sourceNote,
      sourceSupport: parseRoutePlaceStorySourceSupport(existing),
      status: "available",
      title: existing.title,
      voice: {
        id: existing.voiceId,
        label: "Стандартный рассказчик",
        requirementStatus: "default_only",
      },
    });
  }

  const title = `История: ${routePoint.name}`;
  const place = await buildPlaceIntelligenceForStory(routePoint);
  const support = evaluatePlaceStorySupport(place);
  if (!support.supported) {
    await saveRoutePlaceStoryUnavailable(event.context.user.id, {
      ...request,
      sourceNote: "История недоступна, пока не появится больше фактов о месте из источников.",
      sourceSupport: support,
      title,
      voiceId: env.OPENAI_TTS_VOICE,
    });

    return createUnavailablePlaceStoryResponse({
      request,
      sourceSupport: support,
      title,
      voiceId: env.OPENAI_TTS_VOICE,
    });
  }

  try {
    const generated = await generatePlaceStoryAudio(place);
    const audioObjectKey = createPlaceStoryAudioObjectKey(event.context.user.id, request);
    await savePlaceStoryAudioObject({
      audioBytes: generated.audioBytes,
      contentType: generated.contentType,
      key: audioObjectKey,
      routePointId: request.routePointId,
      sessionId: request.sessionId,
      userId: event.context.user.id,
      variantId: request.variantId,
    });

    const audio = createAvailableAudioMetadata({
      byteLength: generated.audioBytes.byteLength,
      contentType: generated.contentType,
      request,
    });

    await saveRoutePlaceStoryAudio(event.context.user.id, {
      ...request,
      audio,
      audioObjectKey,
      sourceNote: PLACE_STORY_SOURCE_NOTE,
      sourceSupport: generated.sourceSupport,
      title,
      voiceId: env.OPENAI_TTS_VOICE,
    });

    return PlaceStoryResponseSchema.parse({
      audio,
      disclosure: PLACE_STORY_DISCLOSURE,
      failureCode: null,
      routePointId: request.routePointId,
      sourceNote: PLACE_STORY_SOURCE_NOTE,
      sourceSupport: generated.sourceSupport,
      status: "available",
      title,
      voice: {
        id: env.OPENAI_TTS_VOICE,
        label: "Стандартный рассказчик",
        requirementStatus: "default_only",
      },
    });
  }
  catch (error) {
    const failureCode = error instanceof PlaceStoryProviderError ? error.code : "unexpected_error";
    await saveRoutePlaceStoryFailed(event.context.user.id, {
      ...request,
      failureCode,
      sourceNote: "Не удалось сгенерировать аудиоисторию прямо сейчас.",
      sourceSupport: support,
      title,
      voiceId: env.OPENAI_TTS_VOICE,
    });

    throw createError({
      statusCode: failureCode === "missing_tts_api_key" ? 503 : 502,
      statusMessage: "Аудиоистория недоступна",
    });
  }
});
