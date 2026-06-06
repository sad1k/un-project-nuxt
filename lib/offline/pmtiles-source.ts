// Thin wrapper around the `pmtiles` JS package. The module is loaded
// dynamically on first use so it never enters the SSR bundle and never
// hurts the initial client compile graph.

// Tiles are read through a SAME-ORIGIN server proxy, not straight from
// Protomaps. The public daily-build host (build.protomaps.com) does not send
// `Access-Control-Allow-Origin`, so a direct browser fetch is CORS-blocked.
// The proxy (server/routes/offline/pmtiles.get.ts) resolves the real upstream
// server-side — the rotating daily build, or a private `PMTILES_URL` override —
// and forwards byte-range requests back to us same-origin.
const PMTILES_PROXY_PATH = "/offline/pmtiles";

type PmtilesArchive = {
  getZxy: (z: number, x: number, y: number) => Promise<{ data: ArrayBuffer | Uint8Array } | undefined>;
};

type PmtilesModule = {
  PMTiles: new (sourceOrUrl: unknown) => PmtilesArchive;
  FetchSource?: new (url: string) => unknown;
};

let modulePromise: Promise<PmtilesModule> | null = null;
let archive: PmtilesArchive | null = null;
let archiveUrl: string | null = null;

async function loadPmtilesModule(): Promise<PmtilesModule> {
  if (!modulePromise)
    modulePromise = import("pmtiles") as unknown as Promise<PmtilesModule>;
  return modulePromise;
}

// Absolute same-origin URL for the tile proxy. The `pmtiles` FetchSource issues
// range requests against it; being same-origin, no CORS applies.
export function resolvePmtilesUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${PMTILES_PROXY_PATH}`;
}

export async function getPmtilesArchive(url: string = resolvePmtilesUrl()): Promise<PmtilesArchive> {
  if (archive && archiveUrl === url)
    return archive;

  const mod = await loadPmtilesModule();
  // The pmtiles `PMTiles` constructor accepts either a URL string or a custom
  // Source. Pass the URL — the library creates its own FetchSource.
  archive = new mod.PMTiles(url);
  archiveUrl = url;
  return archive;
}

export async function fetchTileBytes(z: number, x: number, y: number): Promise<Uint8Array | null> {
  const a = await getPmtilesArchive();
  const tile = await a.getZxy(z, x, y);
  if (!tile?.data)
    return null;
  return tile.data instanceof Uint8Array ? tile.data : new Uint8Array(tile.data);
}
