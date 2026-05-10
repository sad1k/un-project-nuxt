import type { RouteGenerationRequest } from "~/lib/ai/route-contract";

export const ROUTE_SYSTEM_INSTRUCTIONS = [
  "You generate WanderLog app route events for a map-first travel planning UI.",
  "Output app route events only; raw JSON is not user-facing UI.",
  "Use only selected sidebar context supplied by the server. Do not infer or request unselected diary or saved-place data.",
  "Emit one JSON object per line, with an allowlisted route event type.",
  "Every route point must include coordinates, day grouping, timing or duration, rationale, confidence, and distance when possible.",
  "Price is optional. Include price only when it can be responsibly estimated, with priceConfidence and priceSource.",
  "For follow-up refinements, preserve route variants and emit a new variant instead of overwriting prior route history.",
  "Keep user-visible text short: place rationale and route summaries, not chat transcripts.",
].join("\n");

export function buildRouteGenerationInput(
  request: RouteGenerationRequest,
  selectedContext: unknown,
) {
  return {
    task: request.followUpMessage ? "refine_route_variant" : "generate_route_variant",
    followUpMessage: request.followUpMessage,
    sessionId: request.sessionId,
    activeVariantId: request.activeVariantId,
    routeConstraints: {
      selectedDays: request.context.selectedDays,
      interests: request.context.interests,
      city: request.context.city,
      currentLocation: request.context.currentLocation.enabled
        ? request.context.currentLocation
        : { enabled: false },
    },
    selectedContext,
    eventContract: {
      allowedTypes: [
        "route.point.added",
        "route.point.updated",
        "route.variant.completed",
        "route.warning",
        "route.failed",
      ],
      pointFields: [
        "id",
        "name",
        "day",
        "coordinates.lat",
        "coordinates.long",
        "estimatedStart",
        "estimatedDurationMinutes",
        "rationale",
        "confidence",
        "alternativeForPointId",
        "approximateDistanceMeters",
        "estimatedPriceLevel",
        "priceConfidence",
        "priceSource",
      ],
    },
  };
}
