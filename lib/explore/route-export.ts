import type { RouteMapPoint } from "./route-map";

// Deep links that open the current route in external navigation apps
// (Google Maps / Yandex Maps). Pure string builders — trivially testable and
// reusable from any view that holds RouteMapPoint[].
//
// Coordinate-order gotcha: Google uses lat,lng everywhere; Yandex's `rtext`
// (route) is lat,lng but its `pt` (single placemark) is lng,lat.

export type RouteExportProvider = "google" | "yandex";

export type RouteExportLink = {
  url: string;
  // Stops actually encoded into the link.
  stopCount: number;
  // Trailing stops dropped to respect the provider's practical cap.
  droppedCount: number;
};

// Google consumer Maps reliably honours origin + destination + ~8 waypoints;
// keep the whole link at 10 stops to stay within that.
const GOOGLE_MAX_STOPS = 10;
// Yandex tolerates long rtext chains; cap only to keep the URL a sane length.
const YANDEX_MAX_STOPS = 30;

function latLng(point: RouteMapPoint): string {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function capStops(points: RouteMapPoint[], max: number): { stops: RouteMapPoint[]; droppedCount: number } {
  if (points.length <= max)
    return { stops: points, droppedCount: 0 };
  return { stops: points.slice(0, max), droppedCount: points.length - max };
}

export function buildGoogleMapsRouteUrl(points: RouteMapPoint[]): RouteExportLink | null {
  if (!points.length)
    return null;
  const { stops, droppedCount } = capStops(points, GOOGLE_MAX_STOPS);

  if (stops.length === 1)
    return { url: `https://www.google.com/maps/search/?api=1&query=${latLng(stops[0])}`, stopCount: 1, droppedCount };

  const origin = latLng(stops[0]);
  const destination = latLng(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(latLng).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}`;
  if (waypoints)
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return { url, stopCount: stops.length, droppedCount };
}

export function buildYandexMapsRouteUrl(points: RouteMapPoint[]): RouteExportLink | null {
  if (!points.length)
    return null;
  const { stops, droppedCount } = capStops(points, YANDEX_MAX_STOPS);

  if (stops.length === 1)
    return { url: `https://yandex.ru/maps/?pt=${stops[0].lng.toFixed(6)},${stops[0].lat.toFixed(6)}&z=15`, stopCount: 1, droppedCount };

  const rtext = stops.map(latLng).join("~");
  return { url: `https://yandex.ru/maps/?rtext=${rtext}&rtt=auto`, stopCount: stops.length, droppedCount };
}

export function buildRouteExportLink(provider: RouteExportProvider, points: RouteMapPoint[]): RouteExportLink | null {
  return provider === "google" ? buildGoogleMapsRouteUrl(points) : buildYandexMapsRouteUrl(points);
}
