import { createMockAiRouteEventStream } from "~/lib/ai/mock-route-stream";
import { fetchOpenAiCompatibleRouteStream, sanitizeProviderError } from "~/lib/ai/openai-compatible";
import { buildSelectedRouteContext } from "~/lib/ai/route-context";
import { createRouteWarningEvent, isRoutePointEvent, RouteEventEnvelopeSchema, RouteGenerationRequestSchema } from "~/lib/ai/route-contract";
import { buildRouteGenerationInput, ROUTE_SYSTEM_INSTRUCTIONS } from "~/lib/ai/route-prompts";
import {
  appendAiRouteMessage,
  createAiRouteSession,
  createAiRouteVariant,
  findAiRouteSessionByIdForUser,
  markAiRouteVariantCompleted,
  markAiRouteVariantFailed,
  persistAiRouteEvent,
  persistAiRoutePoint,
} from "~/lib/db/queries/ai-route";
import env from "~/lib/env";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, RouteGenerationRequestSchema.parse);
  const userId = event.context.user.id;
  const selectedContext = await buildSelectedRouteContext(userId, body.context);
  const session = body.sessionId
    ? await findAiRouteSessionByIdForUser(userId, body.sessionId)
    : await createAiRouteSession(userId, { requestContext: body.context });

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: "Route session not found",
    });
  }

  const variant = await createAiRouteVariant(userId, {
    sessionId: session.id,
    parentVariantId: body.activeVariantId,
  });

  if (!variant) {
    throw createError({
      statusCode: 500,
      statusMessage: "Route variant could not be created",
    });
  }

  await appendAiRouteMessage(userId, {
    sessionId: session.id,
    role: "user",
    summary: body.followUpMessage || `Generate route for ${body.context.city?.name || "selected city"}`,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let sequence = 0;
      let textBuffer = "";
      let completed = false;

      const emit = async (input: unknown) => {
        const validated = RouteEventEnvelopeSchema.safeParse(input);
        if (!validated.success) {
          const warning = createRouteWarningEvent({
            sequence: sequence++,
            sessionId: session.id,
            variantId: variant.id,
            code: "invalid_route_event_skipped",
            message: "A route update could not be validated and was skipped.",
          });
          await persistAiRouteEvent(userId, {
            sessionId: session.id,
            variantId: variant.id,
            sequence: warning.sequence,
            event: warning,
            validationStatus: "skipped",
          });
          controller.enqueue(encoder.encode(formatSse(warning)));
          return;
        }

        const routeEvent = validated.data;
        await persistAiRouteEvent(userId, {
          sessionId: session.id,
          variantId: routeEvent.variantId,
          sequence: routeEvent.sequence,
          event: routeEvent,
        });

        if (isRoutePointEvent(routeEvent)) {
          await persistAiRoutePoint(userId, {
            variantId: routeEvent.variantId,
            sequence: routeEvent.sequence,
            point: routeEvent.point,
          });
        }

        if (routeEvent.type === "route.variant.completed") {
          completed = true;
          await markAiRouteVariantCompleted(userId, {
            sessionId: session.id,
            variantId: variant.id,
            title: routeEvent.title,
            summary: routeEvent.summary,
          });
        }

        controller.enqueue(encoder.encode(formatSse(routeEvent)));
      };

      try {
        await emit({
          type: "route.session.created",
          sequence: sequence++,
          sessionId: session.id,
          activeVariantId: variant.id,
        });
        await emit({
          type: "route.variant.started",
          sequence: sequence++,
          sessionId: session.id,
          variantId: variant.id,
          parentVariantId: body.activeVariantId,
        });

        if (env.AI_ROUTE_MOCK_ENABLED) {
          const mockStream = createMockAiRouteEventStream({
            request: body,
            sessionId: session.id,
            variantId: variant.id,
            startSequence: sequence,
          });

          for await (const routeEvent of mockStream) {
            sequence = routeEvent.sequence + 1;
            await emit(routeEvent);
          }
        }
        else {
          const providerStream = fetchOpenAiCompatibleRouteStream({
            instructions: ROUTE_SYSTEM_INSTRUCTIONS,
            input: buildRouteGenerationInput(body, selectedContext),
          });

          for await (const providerEvent of providerStream) {
            textBuffer += extractProviderTextDelta(providerEvent);
            const [lines, rest] = splitReadyJsonLines(textBuffer);
            textBuffer = rest;

            for (const line of lines) {
              const candidate = parseJsonLine(line);
              if (!candidate)
                continue;

              await emit(enrichRouteEvent(candidate, {
                sessionId: session.id,
                variantId: variant.id,
                sequence: sequence++,
              }));
            }
          }

          const finalCandidate = parseJsonLine(textBuffer);
          if (finalCandidate) {
            await emit(enrichRouteEvent(finalCandidate, {
              sessionId: session.id,
              variantId: variant.id,
              sequence: sequence++,
            }));
          }
        }

        if (!completed) {
          await emit({
            type: "route.variant.completed",
            sequence: sequence++,
            sessionId: session.id,
            variantId: variant.id,
            summary: "Route generation completed.",
          });
        }
      }
      catch (error) {
        const code = sanitizeProviderError(error instanceof Error ? error.message : "provider_request_failed");
        await markAiRouteVariantFailed(userId, {
          sessionId: session.id,
          variantId: variant.id,
          failureCode: code,
        });
        await emit({
          type: "route.failed",
          sequence: sequence++,
          sessionId: session.id,
          variantId: variant.id,
          code,
          message: "Route generation failed. Try again with adjusted preferences.",
        });
      }
      finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
});

function formatSse(input: unknown) {
  return `data: ${JSON.stringify(input)}\n\n`;
}

function extractProviderTextDelta(input: Record<string, unknown>) {
  if (typeof input.delta === "string")
    return input.delta;

  if (typeof input.text === "string")
    return input.text;

  if (typeof input.output_text === "string")
    return input.output_text;

  return "";
}

function splitReadyJsonLines(buffer: string): [string[], string] {
  const lines = buffer.split(/\r?\n/);
  return [lines.slice(0, -1).filter(Boolean), lines.at(-1) || ""];
}

function parseJsonLine(line: string) {
  try {
    const parsed = JSON.parse(line);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  }
  catch {
    return null;
  }
}

function enrichRouteEvent(
  input: Record<string, unknown>,
  context: { sessionId: number; variantId: number; sequence: number },
) {
  return {
    ...input,
    sequence: context.sequence,
    sessionId: context.sessionId,
    variantId: context.variantId,
  };
}
