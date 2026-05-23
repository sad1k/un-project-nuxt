import { findAdminAiRouteSessionDetail } from "~/lib/db/queries/ai-route";
import defineAdminHandler from "~/utils/define-admin-handler";

export default defineAdminHandler(async (event) => {
  const sessionId = parseSessionId(getRouterParam(event, "session-id"));
  const session = await findAdminAiRouteSessionDetail(sessionId);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Сессия генерации маршрута не найдена",
    });
  }

  return session;
});

function parseSessionId(input: string | undefined) {
  const sessionId = Number(input);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Некорректный ID сессии генерации маршрута",
    });
  }

  return sessionId;
}
