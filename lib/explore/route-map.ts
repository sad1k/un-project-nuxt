import type { RoutePoint } from "~/lib/ai/route-contract";

export type RouteMarkerKind = "generated" | "current-location" | "user-place";

export type RouteMapPoint = {
  id: string;
  sourceId: string;
  markerKind: RouteMarkerKind;
  sequence: number;
  day: number;
  name: string;
  lat: number;
  lng: number;
  rationale?: string;
  estimatedDurationMinutes?: number;
  approximateDistanceMeters?: number;
};

export type RouteLeg = {
  id: string;
  from: RouteMapPoint;
  to: RouteMapPoint;
  day: number;
  distanceMeters: number | null;
  distanceLabel: string | null;
  midpoint: {
    lat: number;
    lng: number;
  };
};

export type RouteDayGroup = {
  day: number;
  points: RouteMapPoint[];
  pointCount: number;
};

export type RouteDistanceSummary = {
  knownDistanceMeters: number;
  knownDistanceLabel: string | null;
  knownLegCount: number;
  missingLegCount: number;
  totalLegCount: number;
  complete: boolean;
};

export function toRouteMapPoints(
  points: RoutePoint[],
  markerKind: RouteMarkerKind = "generated",
): RouteMapPoint[] {
  return points.map((point, index) => ({
    id: `${markerKind}-${point.id}`,
    sourceId: point.id,
    markerKind,
    sequence: index,
    day: point.day,
    name: point.name,
    lat: point.coordinates.lat,
    lng: point.coordinates.long,
    rationale: point.rationale,
    estimatedDurationMinutes: point.estimatedDurationMinutes,
    approximateDistanceMeters: point.approximateDistanceMeters,
  }));
}

export function getRouteDayGroups(points: RoutePoint[] | RouteMapPoint[]): RouteDayGroup[] {
  const mapPoints = normalizeRouteMapPoints(points);
  const groups = new Map<number, RouteMapPoint[]>();

  for (const point of mapPoints) {
    groups.set(point.day, [...(groups.get(point.day) || []), point]);
  }

  return [...groups.entries()]
    .sort(([firstDay], [secondDay]) => firstDay - secondDay)
    .map(([day, dayPoints]) => ({
      day,
      points: dayPoints,
      pointCount: dayPoints.length,
    }));
}

export function filterRoutePointsByDay<T extends RoutePoint | RouteMapPoint>(
  points: T[],
  selectedDay: number | null | undefined,
): T[] {
  if (!selectedDay)
    return points;

  return points.filter(point => point.day === selectedDay);
}

export function buildRouteLegs(points: RoutePoint[] | RouteMapPoint[]): RouteLeg[] {
  const mapPoints = normalizeRouteMapPoints(points);

  return mapPoints.slice(1).map((point, index) => {
    const previous = mapPoints[index];
    const distanceMeters = point.approximateDistanceMeters ?? null;

    return {
      id: `${previous.sourceId}-${point.sourceId}`,
      from: previous,
      to: point,
      day: point.day,
      distanceMeters,
      distanceLabel: formatRouteDistance(distanceMeters),
      midpoint: {
        lat: (previous.lat + point.lat) / 2,
        lng: (previous.lng + point.lng) / 2,
      },
    };
  });
}

export function summarizeRouteDistance(legs: RouteLeg[]): RouteDistanceSummary {
  const knownLegs = legs.filter(leg => typeof leg.distanceMeters === "number");
  const knownDistanceMeters = knownLegs.reduce((total, leg) => total + (leg.distanceMeters || 0), 0);
  const missingLegCount = legs.length - knownLegs.length;

  return {
    knownDistanceMeters,
    knownDistanceLabel: formatRouteDistance(knownLegs.length ? knownDistanceMeters : null),
    knownLegCount: knownLegs.length,
    missingLegCount,
    totalLegCount: legs.length,
    complete: legs.length > 0 && missingLegCount === 0,
  };
}

export function formatRouteDistance(meters: number | null | undefined): string | null {
  if (typeof meters !== "number")
    return null;

  if (meters < 1000)
    return `${Math.round(meters)} m`;

  const kilometers = meters / 1000;
  return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
}

const EARTH_RADIUS_METERS = 6371000;

type LngLatLike = {
  lat: number;
  lng: number;
};

export function haversineDistanceMeters(from: LngLatLike, to: LngLatLike): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a = Math.sin(deltaLat / 2) ** 2
    + Math.sin(deltaLng / 2) ** 2 * Math.cos(fromLat) * Math.cos(toLat);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Returns the index at which `candidate` should be spliced into `points` so the
// total path grows as little as possible — the classic cheapest-insertion
// heuristic. This keeps a manually dropped stop "on the way" instead of forcing
// a long detour.
export function findCheapestInsertionIndex(points: LngLatLike[], candidate: LngLatLike): number {
  if (points.length === 0)
    return 0;
  if (points.length === 1)
    return 1;

  // Seed with the two endpoints: append after the last stop or prepend before
  // the first one.
  let bestIndex = points.length;
  let bestCost = haversineDistanceMeters(points[points.length - 1], candidate);

  const prependCost = haversineDistanceMeters(candidate, points[0]);
  if (prependCost < bestCost) {
    bestIndex = 0;
    bestCost = prependCost;
  }

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const next = points[i];
    const detour = haversineDistanceMeters(previous, candidate)
      + haversineDistanceMeters(candidate, next)
      - haversineDistanceMeters(previous, next);

    if (detour < bestCost) {
      bestIndex = i;
      bestCost = detour;
    }
  }

  return bestIndex;
}

// Weaves user-dropped points into a base route one at a time, each at its
// cheapest slot, then renumbers the combined sequence.
export function foldUserPointsIntoRoute(
  basePoints: RouteMapPoint[],
  userPoints: RouteMapPoint[],
): RouteMapPoint[] {
  let combined = [...basePoints];

  for (const userPoint of userPoints) {
    const index = findCheapestInsertionIndex(combined, userPoint);
    combined = [...combined.slice(0, index), userPoint, ...combined.slice(index)];
  }

  return combined.map((point, index) => ({ ...point, sequence: index }));
}

function normalizeRouteMapPoints(points: RoutePoint[] | RouteMapPoint[]): RouteMapPoint[] {
  if (points.length === 0)
    return [];

  if (isRouteMapPoint(points[0]))
    return points as RouteMapPoint[];

  return toRouteMapPoints(points as RoutePoint[]);
}

function isRouteMapPoint(point: RoutePoint | RouteMapPoint): point is RouteMapPoint {
  return "lng" in point && "markerKind" in point;
}
