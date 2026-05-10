import type { RouteEventEnvelope, RouteGenerationRequest, RoutePoint } from "~/lib/ai/route-contract";

const MOCK_STREAM_DELAY_MS = 350;

export async function* createMockAiRouteEventStream(input: {
  request: RouteGenerationRequest;
  sessionId: number;
  variantId: number;
  startSequence: number;
}): AsyncGenerator<RouteEventEnvelope> {
  const points = buildMockRoutePoints(input.request);

  for (const [index, point] of points.entries()) {
    await wait(MOCK_STREAM_DELAY_MS);
    yield {
      type: "route.point.added",
      sequence: input.startSequence + index,
      sessionId: input.sessionId,
      variantId: input.variantId,
      point,
    };
  }

  await wait(MOCK_STREAM_DELAY_MS);
  yield {
    type: "route.variant.completed",
    sequence: input.startSequence + points.length,
    sessionId: input.sessionId,
    variantId: input.variantId,
    title: input.request.followUpMessage ? "Refined mock route" : "Mock AI route",
    summary: "Mock stream completed with map-ready route points.",
  };
}

function buildMockRoutePoints(request: RouteGenerationRequest): RoutePoint[] {
  const city = request.context.city;
  const base = city?.coordinates || { lat: 40.7128, long: -74.006 };
  const selectedCandidates = request.context.candidatePlaces.filter(place => place.selected);
  const candidatePoints = selectedCandidates
    .slice(0, 4)
    .map((place, index): RoutePoint => ({
      id: `mock-candidate-${place.id}`.slice(0, 80),
      name: place.name,
      day: Math.min(request.context.selectedDays, Math.floor(index / 3) + 1),
      coordinates: place.coordinates || offsetCoordinates(base, index),
      estimatedStart: `${9 + index * 2}:00`,
      estimatedDurationMinutes: 75,
      rationale: place.description || `Selected ${place.name} from your Explore sidebar context.`,
      confidence: "medium",
      approximateDistanceMeters: index === 0 ? 0 : 1200 + index * 650,
      estimatedPriceLevel: index % 2 === 0 ? "low" : "unknown",
      priceConfidence: index % 2 === 0 ? "low" : undefined,
      priceSource: index % 2 === 0 ? "mock estimate" : undefined,
    }));

  if (candidatePoints.length)
    return candidatePoints;

  const cityName = city?.name || "your city";
  const interests = request.context.interests.length ? request.context.interests : ["culture", "food", "nature"];

  return interests.slice(0, Math.max(3, Math.min(6, request.context.selectedDays * 2))).map((interest, index): RoutePoint => ({
    id: `mock-${interest}-${index + 1}`,
    name: `${titleCase(interest)} stop in ${cityName}`,
    day: Math.min(request.context.selectedDays, Math.floor(index / 3) + 1),
    coordinates: offsetCoordinates(base, index),
    estimatedStart: `${9 + index * 2}:00`,
    estimatedDurationMinutes: 90,
    rationale: request.followUpMessage
      ? `Adjusted for your follow-up: ${request.followUpMessage.slice(0, 120)}`
      : `Mock AI selected this stop for your ${interest} interest.`,
    confidence: index < 2 ? "high" : "medium",
    alternativeForPointId: request.followUpMessage && index === 0 ? "previous-active-point" : undefined,
    approximateDistanceMeters: index === 0 ? 0 : 900 + index * 700,
    estimatedPriceLevel: index % 3 === 0 ? "free" : "unknown",
    priceConfidence: index % 3 === 0 ? "medium" : undefined,
    priceSource: index % 3 === 0 ? "mock estimate" : undefined,
  }));
}

function offsetCoordinates(base: { lat: number; long: number }, index: number) {
  const step = 0.012;
  return {
    lat: base.lat + step * (index % 3),
    long: base.long + step * Math.floor(index / 3),
  };
}

function titleCase(value: string) {
  return value
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
