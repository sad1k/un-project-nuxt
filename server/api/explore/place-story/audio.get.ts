import { findRoutePlaceStory, findRoutePointForPlaceStory } from "~/lib/db/queries/route-place-story";
import { PlaceStoryRequestSchema } from "~/lib/explore/place-story";
import { readPlaceStoryAudioObject } from "~/lib/explore/place-story-provider";
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
  if (!story?.audioObjectKey) {
    throw createError({
      statusCode: 404,
      statusMessage: "Аудиоистория не найдена",
    });
  }

  const audio = await readPlaceStoryAudioObject(story.audioObjectKey);

  return new Response(new Uint8Array(audio.audioBytes), {
    headers: {
      "cache-control": "private, max-age=3600",
      "content-length": String(audio.audioBytes.byteLength),
      "content-type": story.audioContentType || audio.contentType,
    },
  });
});
