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
  "selectedContext.anchorPoints are stops the user dropped on the map by hand. The generated route MUST visit every anchor (emit a route point at essentially its coordinates, keeping its Russian name) — never drop or skip one.",
  "Do NOT just connect the anchors in a straight line. Treat them as a skeleton and ADD extra interesting stops that sit genuinely on the way between and around them (minimal detour), chosen to match routeConstraints.interests: cafes, viewpoints, sights, hidden gems, etc.",
  "selectedContext.anchorRegion (when present) is the authoritative geographic scope for the WHOLE route: its bounds, center and radiusMeters describe the area the user actually picked. Keep EVERY emitted point — anchors and added stops alike — inside anchorRegion.bounds, widened by at most anchorRegion.maxDetourMeters. Never emit a stop outside that area, even a famous landmark.",
  "When anchorRegion is present, routeConstraints.city is ONLY a naming/locale hint: do NOT recenter the route on the city center or its well-known central sights. Choose real places that genuinely sit between and immediately around the anchors, never across town.",
  "Respect each anchor's `day`; interleave the anchors and the added stops into a sensible per-day visiting order.",
  "Keep the enrichment moderate: aim for roughly selectedDays × 3-4 total stops (anchors included), guided by the user's interests — do not overcrowd the route.",
  "When followUpMessage is present, treat it as the user's extra free-text wish and honor it alongside the anchors.",
  "Keep user-visible text short: place rationale and route summaries, not chat transcripts.",
].join("\n");

export function buildRouteGenerationInput(
  request: RouteGenerationRequest,
  selectedContext: unknown,
) {
  return {
    task: request.sessionId ? "refine_route_variant" : "generate_route_variant",
    followUpMessage: request.followUpMessage,
    sessionId: request.sessionId,
    activeVariantId: request.activeVariantId,
    routeConstraints: {
      selectedDays: request.context.selectedDays,
      interests: request.context.interests,
      city: request.context.city,
      userAnchorPointCount: request.context.anchorPoints?.length ?? 0,
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
