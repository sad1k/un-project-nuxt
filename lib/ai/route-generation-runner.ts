import type { RouteEventEnvelope, RouteGenerationRequest } from "~/lib/ai/route-contract";

import { createMockAiRouteEventStream } from "~/lib/ai/mock-route-stream";
import { extractProviderTextDelta, fetchOpenAiCompatibleRouteStream, getRouteProviderDiagnostics, sanitizeProviderError } from "~/lib/ai/openai-compatible";
import { createRouteWarningEvent, isRoutePointEvent, RouteEventEnvelopeSchema } from "~/lib/ai/route-contract";
import { buildRouteGenerationInput, ROUTE_SYSTEM_INSTRUCTIONS } from "~/lib/ai/route-prompts";
import {
  claimAiRouteGenerationRun,
  markAiRouteVariantCompleted,
  markAiRouteVariantFailed,
  persistAiRouteEvent,
  persistAiRoutePoint,
  refreshAiRouteGenerationHeartbeat,
} from "~/lib/db/queries/ai-route";
import env from "~/lib/env";
import { logSafeServerEvent } from "~/utils/safe-observability";

type RouteGenerationRunnerInput = {
  userId: number;
  request: RouteGenerationRequest;
  selectedContext: unknown;
  sessionId: number;
  variantId: number;
  parentVariantId?: number;
  eventSink?: (event: RouteEventEnvelope) => void;
};

export async function runRouteGeneration(input: RouteGenerationRunnerInput) {
  const runnerId = createRunnerId();

  await claimAiRouteGenerationRun(input.userId, {
    runnerId,
    sessionId: input.sessionId,
    variantId: input.variantId,
  });
  logSafeServerEvent("warn", "ai.route_generation.started", {
    mockEnabled: env.AI_ROUTE_MOCK_ENABLED,
    provider: env.AI_ROUTE_PROVIDER,
    runnerId,
    sessionId: input.sessionId,
    variantId: input.variantId,
  });

  let sequence = 0;
  let textBuffer = "";
  let completed = false;
  let providerCandidateCount = 0;
  let invalidProviderEventCount = 0;
  let routePointCount = 0;

  const emit = async (rawEvent: unknown) => {
    const validated = RouteEventEnvelopeSchema.safeParse(rawEvent);
    if (!validated.success) {
      invalidProviderEventCount += 1;
      logSafeServerEvent("error", "ai.route_generation.invalid_provider_event", {
        validationIssueCount: validated.error.issues.length,
        validationIssuePaths: validated.error.issues.map(issue => issue.path.join(".")).filter(Boolean),
        sessionId: input.sessionId,
        variantId: input.variantId,
      });

      const warning = createRouteWarningEvent({
        code: "invalid_route_event_skipped",
        message: "A route update could not be validated and was skipped.",
        sequence: sequence++,
        sessionId: input.sessionId,
        variantId: input.variantId,
      });

      await persistAiRouteEvent(input.userId, {
        event: warning,
        sequence: warning.sequence,
        sessionId: input.sessionId,
        validationStatus: "skipped",
        variantId: input.variantId,
      });
      await refreshAiRouteGenerationHeartbeat(input.userId, {
        sessionId: input.sessionId,
        variantId: input.variantId,
      });
      input.eventSink?.(warning);
      return;
    }

    const routeEvent = validated.data;
    await persistAiRouteEvent(input.userId, {
      event: routeEvent,
      sequence: routeEvent.sequence,
      sessionId: input.sessionId,
      variantId: routeEvent.variantId,
    });

    if (isRoutePointEvent(routeEvent)) {
      routePointCount += 1;
      await persistAiRoutePoint(input.userId, {
        point: routeEvent.point,
        sequence: routeEvent.sequence,
        variantId: routeEvent.variantId,
      });
    }

    if (routeEvent.type === "route.variant.completed") {
      completed = true;
      await markAiRouteVariantCompleted(input.userId, {
        sessionId: input.sessionId,
        summary: routeEvent.summary,
        title: routeEvent.title,
        variantId: input.variantId,
      });
    }

    await refreshAiRouteGenerationHeartbeat(input.userId, {
      sessionId: input.sessionId,
      variantId: input.variantId,
    });
    input.eventSink?.(routeEvent);
  };

  try {
    await emit({
      activeVariantId: input.variantId,
      sequence: sequence++,
      sessionId: input.sessionId,
      type: "route.session.created",
    });
    await emit({
      parentVariantId: input.parentVariantId,
      sequence: sequence++,
      sessionId: input.sessionId,
      type: "route.variant.started",
      variantId: input.variantId,
    });

    if (env.AI_ROUTE_MOCK_ENABLED) {
      const mockStream = createMockAiRouteEventStream({
        request: input.request,
        sessionId: input.sessionId,
        startSequence: sequence,
        variantId: input.variantId,
      });

      for await (const routeEvent of mockStream) {
        sequence = routeEvent.sequence + 1;
        await emit(routeEvent);
      }
    }
    else {
      const providerStream = fetchOpenAiCompatibleRouteStream({
        input: buildRouteGenerationInput(input.request, input.selectedContext),
        instructions: ROUTE_SYSTEM_INSTRUCTIONS,
      });

      for await (const providerEvent of providerStream) {
        textBuffer += extractProviderTextDelta(providerEvent);
        const [lines, rest] = splitReadyJsonLines(textBuffer);
        textBuffer = rest;

        for (const line of lines) {
          const candidate = parseJsonLine(line);
          if (!candidate)
            continue;

          providerCandidateCount += 1;
          await emit(enrichRouteEvent(candidate, {
            sequence: sequence++,
            sessionId: input.sessionId,
            variantId: input.variantId,
          }));
        }
      }

      const finalCandidates = parseProviderRouteCandidates(textBuffer);
      for (const candidate of finalCandidates) {
        providerCandidateCount += 1;
        await emit(enrichRouteEvent(candidate, {
          sequence: sequence++,
          sessionId: input.sessionId,
          variantId: input.variantId,
        }));
      }

      if (!providerCandidateCount) {
        logSafeServerEvent("error", "ai.route_generation.no_parseable_events", {
          mockEnabled: env.AI_ROUTE_MOCK_ENABLED,
          sessionId: input.sessionId,
          variantId: input.variantId,
        });
      }
    }

    if (!routePointCount) {
      logSafeServerEvent("error", "ai.route_generation.no_valid_route_points", {
        invalidProviderEventCount,
        mockEnabled: env.AI_ROUTE_MOCK_ENABLED,
        providerCandidateCount,
        sessionId: input.sessionId,
        variantId: input.variantId,
      });
      throw new Error("provider_returned_no_route_points");
    }

    if (!completed) {
      await emit({
        sequence: sequence++,
        sessionId: input.sessionId,
        summary: "Route generation completed.",
        type: "route.variant.completed",
        variantId: input.variantId,
      });
    }

    logSafeServerEvent("warn", "ai.route_generation.completed", {
      invalidProviderEventCount,
      providerCandidateCount,
      routePointCount,
      runnerId,
      sessionId: input.sessionId,
      variantId: input.variantId,
    });
  }
  catch (error) {
    const code = sanitizeProviderError(error instanceof Error ? error.message : "provider_request_failed");
    logSafeServerEvent("error", "ai.route_generation.failed", {
      code,
      mockEnabled: env.AI_ROUTE_MOCK_ENABLED,
      provider: env.AI_ROUTE_PROVIDER,
      ...getRouteProviderDiagnostics(),
      sessionId: input.sessionId,
      variantId: input.variantId,
    });
    await markAiRouteVariantFailed(input.userId, {
      failureCode: code,
      sessionId: input.sessionId,
      variantId: input.variantId,
    });
    await emit({
      code,
      message: getRouteFailureMessage(code),
      sequence: sequence++,
      sessionId: input.sessionId,
      type: "route.failed",
      variantId: input.variantId,
    });
  }
}

export function serializeRouteEventSse(input: RouteEventEnvelope) {
  return `data: ${JSON.stringify(input)}\n\n`;
}

function createRunnerId() {
  return globalThis.crypto?.randomUUID?.() ?? `route-runner:${Date.now()}:${Math.random().toString(36).slice(2)}`;
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

function parseProviderRouteCandidates(input: string) {
  const trimmed = extractProviderJsonText(input);
  if (!trimmed)
    return [];

  const parsed = parseJsonValue(trimmed);
  if (Array.isArray(parsed))
    return parsed.filter(isRecord).flatMap(normalizeProviderRouteCandidate);

  if (isRecord(parsed)) {
    if (Array.isArray(parsed.events))
      return parsed.events.filter(isRecord).flatMap(normalizeProviderRouteCandidate);

    if (isRecord(parsed.event))
      return normalizeProviderRouteCandidate(parsed.event);

    return normalizeProviderRouteCandidate(parsed);
  }

  const embeddedCandidates = extractEmbeddedProviderRouteCandidates(trimmed);
  if (embeddedCandidates.length)
    return embeddedCandidates;

  return trimmed
    .split(/\r?\n/)
    .map(line => parseJsonLine(line))
    .filter(isRecord)
    .flatMap(normalizeProviderRouteCandidate);
}

function parseJsonValue(input: string) {
  try {
    return JSON.parse(input) as unknown;
  }
  catch {
    return null;
  }
}

function stripJsonFence(input: string) {
  return input
    .replace(/^```(?:json|jsonl)?\s*/, "")
    .replace(/\s*```$/, "");
}

function extractProviderJsonText(input: string) {
  const trimmed = stripJsonFence(input).trim();
  if (!trimmed)
    return "";

  const fenced = extractFencedJsonBlock(trimmed);
  if (fenced)
    return fenced;

  if (trimmed.startsWith("{") || trimmed.startsWith("["))
    return trimmed;

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart)
    return trimmed.slice(objectStart, objectEnd + 1).trim();

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart)
    return trimmed.slice(arrayStart, arrayEnd + 1).trim();

  return trimmed;
}

function extractFencedJsonBlock(input: string) {
  const firstFence = input.indexOf("```");
  if (firstFence === -1)
    return "";

  const contentStart = input.indexOf("\n", firstFence + 3);
  if (contentStart === -1)
    return "";

  const secondFence = input.indexOf("```", contentStart + 1);
  if (secondFence === -1)
    return "";

  return input.slice(contentStart + 1, secondFence).trim();
}

function extractEmbeddedProviderRouteCandidates(input: string) {
  return extractJsonObjectLiterals(input)
    .map(object => parseJsonValue(object))
    .filter(isRecord)
    .filter(isProviderRouteEventLike)
    .flatMap(normalizeProviderRouteCandidate);
}

function extractJsonObjectLiterals(input: string) {
  const objects: string[] = [];

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] !== "{")
      continue;

    const object = extractBalancedJsonObject(input, index);
    if (object)
      objects.push(object);
  }

  return objects;
}

function extractBalancedJsonObject(input: string, startIndex: number) {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"")
        inString = false;

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}")
      continue;

    depth -= 1;
    if (depth === 0)
      return input.slice(startIndex, index + 1);
  }

  return "";
}

function isProviderRouteEventLike(input: Record<string, unknown>) {
  return typeof input.type === "string" && input.type.startsWith("route.");
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function getRouteFailureMessage(code: string) {
  if (code === "provider_rate_limited")
    return "The route AI is busy right now. Please try again in a minute.";

  if (code === "provider_auth_failed" || code === "provider_access_denied")
    return "Route AI access failed. Check the provider key or selected model.";

  if (code === "provider_unavailable")
    return "The route AI provider is temporarily unavailable. Please try again soon.";

  return "Route generation failed. Try again with adjusted preferences.";
}

function enrichRouteEvent(
  input: Record<string, unknown>,
  context: { sessionId: number; variantId: number; sequence: number },
) {
  const normalized = normalizeProviderRouteEvent(input);

  return {
    ...normalized,
    sequence: context.sequence,
    sessionId: context.sessionId,
    variantId: context.variantId,
  };
}

function normalizeProviderRouteEvent(input: Record<string, unknown>) {
  if (!isRecord(input.point))
    return input;

  return {
    ...input,
    point: normalizeProviderRoutePoint(input.point),
  };
}

function normalizeProviderRouteCandidate(input: Record<string, unknown>) {
  if (isFlatProviderRoutePointEvent(input))
    return [createPointAddedCandidate(stripProviderEventFields(input))];

  if (typeof input.type === "string")
    return [input];

  if (isProviderRoutePoint(input))
    return [createPointAddedCandidate(input)];

  const dayPoints = getProviderDayPointArray(input);
  if (dayPoints.length)
    return dayPoints.map(({ day, point }) => createPointAddedCandidate({ ...point, day: point.day ?? day }));

  const points = getProviderNestedPointArray(input);
  if (points.length)
    return points.map(point => createPointAddedCandidate(point));

  return [input];
}

function createPointAddedCandidate(point: Record<string, unknown>) {
  return {
    point,
    type: "route.point.added",
  };
}

function isFlatProviderRoutePointEvent(input: Record<string, unknown>) {
  return (input.type === "route.point.added" || input.type === "route.point.updated")
    && !isRecord(input.point)
    && isProviderRoutePoint(input);
}

function stripProviderEventFields(input: Record<string, unknown>) {
  const { sequence, sessionId, type, variantId, ...point } = input;
  void sequence;
  void sessionId;
  void type;
  void variantId;
  return point;
}

function getProviderPointArray(input: Record<string, unknown>) {
  for (const key of ["points", "routePoints", "stops", "places", "activities", "items", "waypoints"]) {
    const value = input[key];
    if (Array.isArray(value))
      return value.filter(isRecord);
  }

  return [];
}

function getProviderDayPointArray(input: Record<string, unknown>) {
  const days = getProviderDayArray(input);
  if (!Array.isArray(days))
    return [];

  return days.filter(isRecord).flatMap((dayEntry, index) => {
    const day = normalizeProviderDay(dayEntry.day ?? dayEntry.dayNumber ?? dayEntry.dayIndex, index);
    return getProviderNestedPointArray(dayEntry).map(point => ({ day, point }));
  });
}

function getProviderDayArray(input: Record<string, unknown>): unknown[] {
  for (const key of ["days", "itinerary", "route", "schedule", "dailyPlan", "dailyPlans"]) {
    const value = input[key];
    if (Array.isArray(value))
      return value;

    if (isRecord(value)) {
      const nested: unknown[] = getProviderDayArray(value);
      if (nested.length)
        return nested;
    }
  }

  return [];
}

function getProviderNestedPointArray(input: Record<string, unknown>, depth = 0): Record<string, unknown>[] {
  if (depth > 4)
    return [];

  const direct = getProviderPointArray(input);
  if (direct.length)
    return direct;

  for (const value of Object.values(input)) {
    if (isRecord(value)) {
      const nested = getProviderNestedPointArray(value, depth + 1);
      if (nested.length)
        return nested;
    }

    if (Array.isArray(value)) {
      const routePoints = value.filter(isRecord).filter(isProviderRoutePoint);
      if (routePoints.length)
        return routePoints;

      for (const entry of value.filter(isRecord)) {
        const nested = getProviderNestedPointArray(entry, depth + 1);
        if (nested.length)
          return nested;
      }
    }
  }

  return [];
}

function isProviderRoutePoint(input: Record<string, unknown>) {
  return typeof getProviderPointName(input) === "string"
    && (
      isRecord(input.coordinates)
      || isRecord(input.location)
      || (typeof input.lat === "number" && typeof input.long === "number")
      || (typeof input.lat === "number" && typeof input.lng === "number")
      || (typeof input.latitude === "number" && typeof input.longitude === "number")
    );
}

function normalizeProviderRoutePoint(point: Record<string, unknown>) {
  const estimatedPriceLevel = normalizeProviderPriceLevel(
    point.estimatedPriceLevel ?? point.priceLevel ?? point.costLevel ?? point.estimatedCost,
  );

  return {
    ...point,
    approximateDistanceMeters: normalizeProviderNumber(
      point.approximateDistanceMeters ?? point.distanceMeters ?? point.distance,
    ),
    confidence: normalizeProviderConfidence(point.confidence),
    coordinates: normalizeProviderCoordinates(point),
    day: normalizeProviderDay(point.day ?? point.dayNumber ?? point.dayIndex, 0),
    estimatedDurationMinutes: normalizeProviderNumber(
      point.estimatedDurationMinutes ?? point.durationMinutes ?? point.visitDurationMinutes,
    ),
    estimatedPriceLevel,
    id: normalizeProviderPointId(point),
    name: getProviderPointName(point),
    priceConfidence: estimatedPriceLevel && estimatedPriceLevel !== "unknown"
      ? normalizeProviderConfidence(point.priceConfidence) || "low"
      : point.priceConfidence,
    priceSource: estimatedPriceLevel && estimatedPriceLevel !== "unknown"
      ? point.priceSource || "provider"
      : point.priceSource,
    rationale: normalizeProviderRationale(point),
  };
}

function normalizeProviderPointId(point: Record<string, unknown>) {
  if (typeof point.id === "string" && point.id.trim())
    return point.id.trim().slice(0, 80);

  const name = getProviderPointName(point) || "route-stop";
  const day = normalizeProviderDay(point.day ?? point.dayNumber ?? point.dayIndex, 0);
  return `provider:${day}:${slugifyProviderId(name)}`.slice(0, 80);
}

function getProviderPointName(point: Record<string, unknown>) {
  for (const value of [point.name, point.title, point.placeName, point.locationName]) {
    if (typeof value === "string" && value.trim())
      return value.trim();
  }

  return undefined;
}

function normalizeProviderDay(input: unknown, index: number) {
  const value = normalizeProviderNumber(input);
  if (typeof value === "number")
    return Math.min(14, Math.max(1, value));

  return Math.min(14, Math.max(1, index + 1));
}

function normalizeProviderCoordinates(point: Record<string, unknown>) {
  if (isRecord(point.coordinates))
    return normalizeProviderCoordinates(point.coordinates);

  if (isRecord(point.location))
    return normalizeProviderCoordinates(point.location);

  if (typeof point.lat === "number" && typeof point.long === "number") {
    return {
      lat: point.lat,
      long: point.long,
    };
  }

  if (typeof point.lat === "number" && typeof point.lng === "number") {
    return {
      lat: point.lat,
      long: point.lng,
    };
  }

  if (typeof point.latitude === "number" && typeof point.longitude === "number") {
    return {
      lat: point.latitude,
      long: point.longitude,
    };
  }

  if (typeof point.lat === "number" && typeof point.lon === "number") {
    return {
      lat: point.lat,
      long: point.lon,
    };
  }

  return point.coordinates;
}

function normalizeProviderRationale(point: Record<string, unknown>) {
  for (const value of [point.rationale, point.description, point.reason, point.notes, point.summary]) {
    if (typeof value === "string" && value.trim())
      return value.trim().slice(0, 500);
  }

  return "Recommended route stop.";
}

function normalizeProviderConfidence(input: unknown) {
  if (input === "low" || input === "medium" || input === "high")
    return input;

  return "medium";
}

function normalizeProviderNumber(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input))
    return Math.round(input);

  if (typeof input === "string" && input.trim()) {
    const parsed = Number.parseInt(input, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function slugifyProviderId(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "route-stop";
}

function normalizeProviderPriceLevel(input: unknown) {
  if (typeof input === "number") {
    if (input <= 0)
      return "free";
    if (input === 1)
      return "low";
    if (input === 2)
      return "medium";
    if (input >= 3)
      return "high";
  }

  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (normalized === "0")
      return "free";
    if (normalized === "1")
      return "low";
    if (normalized === "2")
      return "medium";
    if (normalized === "3" || normalized === "4")
      return "high";
  }

  return input;
}
