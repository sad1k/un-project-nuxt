// Road-following geometry for a sequence of route points, fetched from the
// Mapbox Directions API. Shared between the live explore map (which swaps
// its straight polyline for this geometry) and the offline download flow
// (which captures it once, while online, so the offline preview can render
// the real walking path).

export const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25;
export const MAPBOX_DIRECTIONS_PROFILE = "walking";

export type RoadRoutePoint = {
  lat: number;
  lng: number;
};

export async function fetchMapboxRoadRouteCoordinates(
  points: RoadRoutePoint[],
  accessToken: string,
): Promise<[number, number][]> {
  if (!accessToken || points.length < 2 || points.length > MAPBOX_DIRECTIONS_MAX_WAYPOINTS)
    return [];

  const waypointPath = points
    .map(point => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(";");
  const params = new URLSearchParams({
    access_token: accessToken,
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/${MAPBOX_DIRECTIONS_PROFILE}/${waypointPath}?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok)
      return [];

    const payload = await response.json() as {
      routes?: Array<{
        geometry?: {
          coordinates?: unknown;
        };
      }>;
    };
    const coordinates = payload.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates))
      return [];

    return coordinates.filter(isLngLatCoordinate);
  }
  catch {
    return [];
  }
}

function isLngLatCoordinate(input: unknown): input is [number, number] {
  return Array.isArray(input)
    && input.length >= 2
    && typeof input[0] === "number"
    && typeof input[1] === "number"
    && Number.isFinite(input[0])
    && Number.isFinite(input[1]);
}
