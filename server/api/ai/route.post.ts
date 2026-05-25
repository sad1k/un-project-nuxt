import { buildSelectedRouteContext } from "~/lib/ai/route-context";
import { RouteGenerationRequestSchema } from "~/lib/ai/route-contract";
import { runRouteGeneration, serializeRouteEventSse } from "~/lib/ai/route-generation-runner";
import {
  appendAiRouteMessage,
  countAiRouteVariantsForUserSince,
  createAiRouteSession,
  createAiRouteVariant,
  findAiRouteSessionByIdForUser,
} from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const ROUTE_GENERATION_DAILY_LIMIT = 20;
const ROUTE_GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, RouteGenerationRequestSchema.parse);
  const userId = event.context.user.id;

  const recentCount = await countAiRouteVariantsForUserSince(
    userId,
    Date.now() - ROUTE_GENERATION_WINDOW_MS,
  );

  if (recentCount >= ROUTE_GENERATION_DAILY_LIMIT) {
    throw createError({
      statusCode: 429,
      statusMessage: `Превышен лимит генераций маршрута: ${ROUTE_GENERATION_DAILY_LIMIT} запросов в сутки`,
    });
  }

  const selectedContext = await buildSelectedRouteContext(userId, body.context);
  const session = body.sessionId
    ? await findAiRouteSessionByIdForUser(userId, body.sessionId)
    : await createAiRouteSession(userId, { requestContext: body.context });

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Сессия маршрута не найдена",
    });
  }

  const variant = await createAiRouteVariant(userId, {
    sessionId: session.id,
    parentVariantId: body.activeVariantId,
  });

  if (!variant) {
    throw createError({
      statusCode: 500,
      statusMessage: "Не удалось создать вариант маршрута",
    });
  }

  await appendAiRouteMessage(userId, {
    sessionId: session.id,
    role: "user",
    summary: body.followUpMessage || `Сгенерировать маршрут для ${body.context.city?.name || "выбранного города"}`,
  });

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  let streamClosed = false;

  const closeStream = async () => {
    if (streamClosed)
      return;

    streamClosed = true;

    try {
      await writer.close();
    }
    catch {
      // The browser can leave while generation continues in the background.
    }
  };

  const runPromise = runRouteGeneration({
    parentVariantId: body.activeVariantId,
    request: body,
    selectedContext,
    sessionId: session.id,
    userId,
    variantId: variant.id,
    eventSink(routeEvent) {
      if (streamClosed)
        return;

      void writer
        .write(encoder.encode(serializeRouteEventSse(routeEvent)))
        .catch(() => {
          streamClosed = true;
        });
    },
  }).finally(closeStream);

  event.waitUntil?.(runPromise);

  return new Response(stream.readable, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
});
