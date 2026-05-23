import { deleteAiRouteSessionByIdForUser } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const sessionId = parseSessionId(getRouterParam(event, "session-id"));
  const deletedSession = await deleteAiRouteSessionByIdForUser(event.context.user.id, sessionId);

  if (!deletedSession) {
    throw createError({
      statusCode: 404,
      statusMessage: "Сессия маршрута не найдена",
    });
  }

  setResponseStatus(event, 204);
  return null;
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
