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

// Custom scheme for label glyphs. Routing text through addProtocol (instead of a
// plain `glyphs` URL) lets us GUARANTEE a resolved response: a missing/unbundled
// range or an offline cache-miss returns a valid empty glyph PBF rather than a
// rejected fetch. That matters because maplibre-gl 4.x treats a failed glyph
// fetch as fatal — it aborts the whole tile parse and blanks the map. The actual
// glyph bytes still live as precached static files under /fonts/.
export const GLYPH_PROTOCOL = "offline-glyphs";
export const OFFLINE_GLYPHS_URL = `${GLYPH_PROTOCOL}://{fontstack}/{range}.pbf`;

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

  // Label glyphs: fetch the precached static PBF; on any miss hand MapLibre an
  // empty (but valid) glyph buffer so those codepoints are skipped gracefully
  // instead of failing the tile. The handler must never reject.
  root.addProtocol(GLYPH_PROTOCOL, async (params) => {
    const path = params.url.replace(`${GLYPH_PROTOCOL}://`, "");
    try {
      const response = await fetch(`/fonts/${path}`);
      if (response.ok)
        return { data: await response.arrayBuffer() };
    }
    catch {
      // Offline cache-miss — fall through to the empty-glyph fallback.
    }
    return { data: new ArrayBuffer(0) };
  });

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
    // view) so the worker thread can transfer ownership cleanly. Copy into a
    // freshly allocated ArrayBuffer so the type is a plain ArrayBuffer rather
    // than ArrayBufferLike (which could be a SharedArrayBuffer).
    const view = tile.data;
    const buffer = new ArrayBuffer(view.byteLength);
    new Uint8Array(buffer).set(view);
    return { data: buffer };
  });

  registered = true;
}

export function buildOfflineTileUrl(regionId: string): string {
  return `${OFFLINE_PROTOCOL}://${regionId}/{z}/{x}/{y}`;
}
