import type { Bbox } from "./bbox-from-route";

const MIN_ZOOM = 0;
const MAX_ZOOM = 14;
const AVG_BYTES_PER_TILE = 25 * 1024; // ~25 KB for compressed vector tiles
const BASE_OVERHEAD_BYTES = 2 * 1024 * 1024; // ~2 MB for the archive index + style JSON

/**
 * Heuristic estimate of the PMTiles archive size for a given bbox across
 * the default zoom range. The number is for UX preview only — the real
 * downloaded size is decided when the archive byte-ranges are actually
 * requested at runtime.
 */
export function estimateRegionSize(bbox: Bbox): { bytes: number; tiles: number } {
  let tiles = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z += 1)
    tiles += tilesAtZoom(bbox, z);

  return {
    bytes: BASE_OVERHEAD_BYTES + tiles * AVG_BYTES_PER_TILE,
    tiles,
  };
}

/** Format a byte count as a user-facing megabyte string in Russian. */
export function formatSizeMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1)
    return "< 1 МБ";
  if (mb < 10)
    return `${mb.toFixed(1)} МБ`;
  return `${Math.round(mb)} МБ`;
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
