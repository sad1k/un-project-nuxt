import type { RouteMapPoint } from "~/lib/explore/route-map";

export type Bbox = readonly [west: number, south: number, east: number, north: number];

const DEFAULT_PADDING_KM = 10;
const KM_PER_DEGREE_LAT = 111;

/**
 * Compute a padded bounding box around a list of route points.
 *
 * Returns `null` when no valid points are provided.
 *
 * The padding (default 10 km) expands the bbox so the user can download
 * a slightly larger region than the strict point envelope — useful for
 * detours, nearby search, and panning around in the offline map.
 */
export function bboxFromRoute(
  points: RouteMapPoint[],
  paddingKm: number = DEFAULT_PADDING_KM,
): Bbox | null {
  const valid = points.filter(point =>
    Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
    && point.lat >= -90
    && point.lat <= 90
    && point.lng >= -180
    && point.lng <= 180,
  );

  if (valid.length === 0)
    return null;

  let west = valid[0].lng;
  let east = valid[0].lng;
  let south = valid[0].lat;
  let north = valid[0].lat;

  for (const point of valid) {
    if (point.lng < west)
      west = point.lng;
    if (point.lng > east)
      east = point.lng;
    if (point.lat < south)
      south = point.lat;
    if (point.lat > north)
      north = point.lat;
  }

  // Longitude degrees shrink at high latitudes — scale the longitudinal
  // padding by cos(mid-lat) so the padding is roughly equal in kilometres
  // on both axes.
  const midLat = (south + north) / 2;
  const latDelta = paddingKm / KM_PER_DEGREE_LAT;
  const lngDelta = paddingKm / (KM_PER_DEGREE_LAT * Math.max(0.001, Math.cos(toRad(midLat))));

  return [
    clamp(west - lngDelta, -180, 180),
    clamp(south - latDelta, -90, 90),
    clamp(east + lngDelta, -180, 180),
    clamp(north + latDelta, -90, 90),
  ];
}

/**
 * Check whether `outer` fully covers `inner` (inner is contained in
 * outer). Treats bboxes as axis-aligned rectangles in lng/lat space —
 * sufficient for the city-scale regions we care about, where the
 * antimeridian is not relevant.
 */
export function bboxCovers(outer: Bbox, inner: Bbox): boolean {
  return (
    outer[0] <= inner[0]
    && outer[1] <= inner[1]
    && outer[2] >= inner[2]
    && outer[3] >= inner[3]
  );
}

/** Rough area of a bbox in square kilometres. */
export function bboxAreaKm2(bbox: Bbox): number {
  const [west, south, east, north] = bbox;
  const midLat = (north + south) / 2;
  const widthKm = (east - west) * KM_PER_DEGREE_LAT * Math.max(0.001, Math.cos(toRad(midLat)));
  const heightKm = (north - south) * KM_PER_DEGREE_LAT;
  return Math.max(0, widthKm * heightKm);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
