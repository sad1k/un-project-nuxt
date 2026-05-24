import type { RouteGenerationRequest } from "~/lib/ai/route-contract";

export const ROUTE_SYSTEM_INSTRUCTIONS = [
  "You generate WanderLog app route events for a map-first travel planning UI.",
  "Output app route events only; raw JSON is not user-facing UI.",
  "Respond in Russian. Every user-visible string MUST be in Russian: the point `name`, `rationale`, route `title`, `summary`, and `priceSource`. If the canonical name of a place is not Russian, use the common Russian rendering (e.g. \"Eiffel Tower\" → \"Эйфелева башня\", \"Times Square\" → \"Таймс-сквер\"). Do NOT translate JSON keys, allowlisted event type values, enum values (low/medium/high/free/unknown), or the `id` field — those stay in their original ASCII form.",
  "Use only selected sidebar context supplied by the server. Do not infer or request unselected diary or saved-place data.",
  "Output exactly one JSON object: {\"events\":[ ... ]} where each array entry is a single route event from the allowlisted types.",
  "Stream points one complete object at a time: fully finish writing each route.point.added event (including its closing brace) before starting the next one so it can render on the map immediately.",
  "Within a point, write id, name, day, and coordinates first; place rationale, confidence and other optional fields afterwards.",
  "Emit route.point.added events in chronological visit order: every day-1 stop in visit order, then every day-2 stop in visit order, and so on.",
  "Do not wrap output in markdown, prose, or explanatory text.",
  "Do not include optional fields with null, empty strings, unknown values, or placeholder values. Omit optional fields unless you have a real valid value.",
  "Only set alternativeForPointId for a genuine replacement/refinement of an existing route point; omit it for ordinary route stops.",
  "Every route point must include coordinates, day grouping, timing or duration, rationale, confidence, and distance when possible.",
  "Price is optional. If included, estimatedPriceLevel must be one of: free, low, medium, high, unknown. Never use numeric price levels. If estimatedPriceLevel is set to anything other than unknown, also include both priceConfidence (low|medium|high) and priceSource (short string).",
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
