import { getTile } from "./region-store";

// Registers a custom MapLibre protocol that pulls vector tiles from
// IndexedDB instead of the network. URLs look like
//   idb-offline://<regionId>/<z>/<x>/<y>
// and a tile source in the style declares them as:
//   "tiles": ["idb-offline://<regionId>/{z}/{x}/{y}"]
//
// MapLibre 4.x's `addProtocol` API expects an async handler that
// returns `{ data: ArrayBuffer }`. We register exactly once per
// browser session to avoid noisy warnings if multiple previews open.

export const OFFLINE_PROTOCOL = "idb-offline";

let registered = false;

export async function ensureOfflineProtocol(): Promise<void> {
  if (registered || typeof window === "undefined")
    return;

  const maplibre = await import("maplibre-gl");
  const root = (maplibre.default ?? maplibre) as typeof maplibre & {
    addProtocol?: (
      name: string,
      handler: (params: { url: string }, abortController?: AbortController) => Promise<{ data: ArrayBuffer }>,
    ) => void;
  };

  if (!root.addProtocol)
    return;

  root.addProtocol(OFFLINE_PROTOCOL, async (params) => {
    const target = params.url.replace(`${OFFLINE_PROTOCOL}://`, "");
    const [regionId, zRaw, xRaw, yRaw] = target.split("/");
    const z = Number(zRaw);
    const x = Number(xRaw);
    const y = Number(yRaw);

    if (!regionId || !Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y))
      throw new Error(`Invalid offline tile URL: ${params.url}`);

    const tile = await getTile(regionId, z, x, y);
    if (!tile)
      throw new Error(`Tile ${z}/${x}/${y} missing for region ${regionId}`);

    // Hand MapLibre a fresh ArrayBuffer (not the IDB-managed Uint8Array
    // view) so the worker thread can transfer ownership cleanly.
    const view = tile.data;
    const buffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    return { data: buffer };
  });

  registered = true;
}

export function buildOfflineTileUrl(regionId: string): string {
  return `${OFFLINE_PROTOCOL}://${regionId}/{z}/{x}/{y}`;
}
