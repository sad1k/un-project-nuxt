import { findRoutePlaceStory, findRoutePointForPlaceStory, parseRoutePlaceStorySourceSupport } from "~/lib/db/queries/route-place-story";
import env from "~/lib/env";
import {
  createPlaceStoryAudioUrl,
  createPlaceStoryCacheKey,
  createReadyPlaceStoryResponse,
  PLACE_STORY_DISCLOSURE,
  PlaceStoryRequestSchema,
  PlaceStoryResponseSchema,
} from "~/lib/explore/place-story";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, PlaceStoryRequestSchema.parse);
  const routePoint = await findRoutePointForPlaceStory(event.context.user.id, query);

  if (!routePoint) {
    throw createError({
      statusCode: 404,
      statusMessage: "Точка маршрута не найдена",
    });
  }

  const story = await findRoutePlaceStory(event.context.user.id, query);
  if (!story) {
    return createReadyPlaceStoryResponse({
      request: query,
      title: `История: ${routePoint.name}`,
      voiceId: env.OPENAI_TTS_VOICE,
    });
  }

  return PlaceStoryResponseSchema.parse({
    audio: story.audioObjectKey
      ? {
          byteLength: story.audioByteLength ?? 0,
          cacheKey: createPlaceStoryCacheKey(query),
          contentType: story.audioContentType ?? "audio/mpeg",
          durationSeconds: story.audioDurationSeconds ?? null,
          generatedAt: story.generatedAt ?? story.updateAt,
          url: createPlaceStoryAudioUrl(query),
        }
      : null,
    disclosure: PLACE_STORY_DISCLOSURE,
    failureCode: story.failureCode,
    routePointId: story.routePointId,
    sourceNote: story.sourceNote,
    sourceSupport: parseRoutePlaceStorySourceSupport(story),
    status: story.status,
    title: story.title,
    voice: {
      id: story.voiceId,
      label: "Стандартный рассказчик",
      requirementStatus: "default_only",
    },
  });
});
