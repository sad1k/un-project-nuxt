// Thin wrapper around the `pmtiles` JS package. The module is loaded
// dynamically on first use so it never enters the SSR bundle and never
// hurts the initial client compile graph.

// Reasonable default — Protomaps' public demo planet, range-served.
// In production this should be replaced with a self-hosted bucket or
// an authenticated Protomaps API endpoint.
const DEFAULT_PMTILES_URL = "https://demo-bucket.protomaps.com/v4.pmtiles";

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

export function getPmtilesUrl(): string {
  const runtime = useRuntimeConfig();
  const fromConfig = (runtime.public as Record<string, unknown>).pmtilesUrl;
  if (typeof fromConfig === "string" && fromConfig.length > 0)
    return fromConfig;
  return DEFAULT_PMTILES_URL;
}

export async function getPmtilesArchive(url: string = getPmtilesUrl()): Promise<PmtilesArchive> {
  if (archive && archiveUrl === url)
    return archive;

  const mod = await loadPmtilesModule();
  // The pmtiles `PMTiles` constructor accepts either a URL string or a
  // custom Source. Pass the URL — the library will create its own
  // FetchSource under the hood.
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
