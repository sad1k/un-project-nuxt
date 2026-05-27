import type { Bbox } from "./bbox-from-route";

// Enumerate all Web Mercator tile coordinates that cover the given bbox
// across a zoom range. Pure function, no I/O. The total count grows
// roughly 4x per zoom level — at z=14 a city-sized bbox can produce
// thousands of tiles, which is why the loader streams them rather than
// materializing the whole list.

export type TileCoord = {
  z: number;
  x: number;
  y: number;
};

export const DEFAULT_MIN_ZOOM = 0;
export const DEFAULT_MAX_ZOOM = 14;

export function countTiles(bbox: Bbox, minZoom = DEFAULT_MIN_ZOOM, maxZoom = DEFAULT_MAX_ZOOM): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z += 1)
    total += tilesAtZoom(bbox, z);
  return total;
}

export function* enumerateTiles(
  bbox: Bbox,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
): Generator<TileCoord, void, unknown> {
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const [west, south, east, north] = bbox;
    const n = 2 ** z;
    const xWest = Math.floor(((west + 180) / 360) * n);
    const xEast = Math.floor(((east + 180) / 360) * n);
    const yNorth = Math.floor(latToTileY(north, n));
    const ySouth = Math.floor(latToTileY(south, n));

    for (let x = xWest; x <= xEast; x += 1) {
      for (let y = yNorth; y <= ySouth; y += 1)
        yield { z, x, y };
    }
  }
}

function tilesAtZoom(bbox: Bbox, zoom: number): number {
  const [west, south, east, north] = bbox;
  const n = 2 ** zoom;
  const xWest = Math.floor(((west + 180) / 360) * n);
  const xEast = Math.floor(((east + 180) / 360) * n);
  const yNorth = Math.floor(latToTileY(north, n));
  const ySouth = Math.floor(latToTileY(south, n));
  const width = Math.max(1, xEast - xWest + 1);
  const height = Math.max(1, ySouth - yNorth + 1);
  return width * height;
}

function latToTileY(lat: number, n: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
}
