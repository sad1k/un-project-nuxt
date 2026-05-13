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
