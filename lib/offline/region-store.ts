import type { Bbox } from "./bbox-from-route";

// Persisted catalogue of downloaded offline regions plus the raw tile
// blobs that back them. Native IndexedDB — no extra deps. v2 adds the
// `tiles` store (indexed by `regionId`) so removing a region can also
// cascade-delete its tiles.

const DB_NAME = "wanderlog-offline";
const DB_VERSION = 2;
const REGIONS_STORE = "regions";
const TILES_STORE = "tiles";
const TILES_REGION_INDEX = "regionId";

export type OfflineRegionStatus = "metadata" | "downloading" | "complete" | "error";

export type OfflineRegion = {
  id: string;
  bbox: Bbox;
  estimatedBytes: number;
  actualBytes: number;
  pointCount: number;
  regionLabel: string | null;
  dateAdded: number;
  lastUsed: number;
  status: OfflineRegionStatus;
  tilesDone?: number;
  totalTiles?: number;
};

export type OfflineRegionInput = {
  bbox: Bbox;
  estimatedBytes: number;
  pointCount: number;
  regionLabel?: string | null;
  status?: OfflineRegionStatus;
  totalTiles?: number;
};

export type OfflineRegionPatch = Partial<
  Pick<OfflineRegion, "status" | "actualBytes" | "tilesDone" | "totalTiles" | "lastUsed">
>;

export type TileRecord = {
  id: string;
  regionId: string;
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
  bytes: number;
};

export type TileInput = Omit<TileRecord, "id" | "bytes">;

export function tileKey(regionId: string, z: number, x: number, y: number): string {
  return `${regionId}|${z}|${x}|${y}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise)
    return dbPromise;
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("IndexedDB is not available in this environment"));

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(REGIONS_STORE))
        db.createObjectStore(REGIONS_STORE, { keyPath: "id" });

      if (oldVersion < 2 && !db.objectStoreNames.contains(TILES_STORE)) {
        const tilesStore = db.createObjectStore(TILES_STORE, { keyPath: "id" });
        tilesStore.createIndex(TILES_REGION_INDEX, "regionId", { unique: false });
      }
    };
  });

  return dbPromise;
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export async function listRegions(): Promise<OfflineRegion[]> {
  const db = await openDb();
  const tx = db.transaction(REGIONS_STORE, "readonly");
  const result = await awaitRequest(tx.objectStore(REGIONS_STORE).getAll());
  return (result as OfflineRegion[]).sort((a, b) => b.lastUsed - a.lastUsed);
}

export async function getRegion(id: string): Promise<OfflineRegion | null> {
  const db = await openDb();
  const tx = db.transaction(REGIONS_STORE, "readonly");
  const result = await awaitRequest(tx.objectStore(REGIONS_STORE).get(id));
  return (result as OfflineRegion | undefined) ?? null;
}

export async function addRegion(input: OfflineRegionInput): Promise<OfflineRegion> {
  const now = Date.now();
  const region: OfflineRegion = {
    id: crypto.randomUUID(),
    bbox: input.bbox,
    estimatedBytes: input.estimatedBytes,
    actualBytes: 0,
    pointCount: input.pointCount,
    regionLabel: input.regionLabel ?? null,
    dateAdded: now,
    lastUsed: now,
    status: input.status ?? "metadata",
    tilesDone: 0,
    totalTiles: input.totalTiles,
  };

  const db = await openDb();
  const tx = db.transaction(REGIONS_STORE, "readwrite");
  await awaitRequest(tx.objectStore(REGIONS_STORE).add(region));
  return region;
}

export async function updateRegion(id: string, patch: OfflineRegionPatch): Promise<OfflineRegion | null> {
  const db = await openDb();
  const tx = db.transaction(REGIONS_STORE, "readwrite");
  const store = tx.objectStore(REGIONS_STORE);
  const existing = await awaitRequest(store.get(id)) as OfflineRegion | undefined;
  if (!existing)
    return null;

  const next: OfflineRegion = { ...existing, ...patch };
  await awaitRequest(store.put(next));
  return next;
}

export async function removeRegion(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([REGIONS_STORE, TILES_STORE], "readwrite");
  // Region row first.
  tx.objectStore(REGIONS_STORE).delete(id);

  // Then every tile belonging to this region — use the regionId index
  // and cursor-delete to avoid pulling all blobs into memory.
  const tilesStore = tx.objectStore(TILES_STORE);
  const index = tilesStore.index(TILES_REGION_INDEX);
  const cursorRequest = index.openCursor(IDBKeyRange.only(id));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor)
      return;
    cursor.delete();
    cursor.continue();
  };

  await awaitTransaction(tx);
}

export async function touchRegion(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(REGIONS_STORE, "readwrite");
  const store = tx.objectStore(REGIONS_STORE);
  const region = await awaitRequest(store.get(id)) as OfflineRegion | undefined;
  if (!region)
    return;
  region.lastUsed = Date.now();
  await awaitRequest(store.put(region));
}

/** Persist a batch of tiles in a single transaction. */
export async function saveTilesBatch(tiles: TileInput[]): Promise<void> {
  if (tiles.length === 0)
    return;
  const db = await openDb();
  const tx = db.transaction(TILES_STORE, "readwrite");
  const store = tx.objectStore(TILES_STORE);
  for (const tile of tiles) {
    const record: TileRecord = {
      id: tileKey(tile.regionId, tile.z, tile.x, tile.y),
      regionId: tile.regionId,
      z: tile.z,
      x: tile.x,
      y: tile.y,
      data: tile.data,
      bytes: tile.data.byteLength,
    };
    store.put(record);
  }
  await awaitTransaction(tx);
}

export async function getTile(regionId: string, z: number, x: number, y: number): Promise<TileRecord | null> {
  const db = await openDb();
  const tx = db.transaction(TILES_STORE, "readonly");
  const result = await awaitRequest(tx.objectStore(TILES_STORE).get(tileKey(regionId, z, x, y)));
  return (result as TileRecord | undefined) ?? null;
}

export async function countTilesForRegion(regionId: string): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(TILES_STORE, "readonly");
  const index = tx.objectStore(TILES_STORE).index(TILES_REGION_INDEX);
  return awaitRequest(index.count(IDBKeyRange.only(regionId)));
}
