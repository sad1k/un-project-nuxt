import type { Bbox } from "./bbox-from-route";
import type { TileInput } from "./region-store";

import { fetchTileBytes } from "./pmtiles-source";
import { saveTilesBatch, updateRegion } from "./region-store";
import { countTiles, enumerateTiles } from "./tile-enumerator";

// Orchestrates the actual fetch-and-store loop for a single region.
// Pulls tile bytes from the PMTiles archive (range-served over HTTP),
// writes them to IndexedDB in batches, and emits coarse progress
// updates the UI can react to. Errors and cancellation propagate
// through the returned promise — both leave the region in a recoverable
// state (status: "error" with whatever was already persisted).

export const BATCH_SIZE = 24;
export const CONCURRENCY = 6;
export const PROGRESS_THROTTLE_MS = 200;

export type DownloadProgress = {
  regionId: string;
  tilesDone: number;
  totalTiles: number;
  bytesDone: number;
};

export type DownloadOptions = {
  regionId: string;
  bbox: Bbox;
  signal?: AbortSignal;
  minZoom?: number;
  maxZoom?: number;
  onProgress?: (progress: DownloadProgress) => void;
};

export type DownloadResult = {
  tilesDone: number;
  totalTiles: number;
  bytesDone: number;
  cancelled: boolean;
};

class CancelledError extends Error {
  constructor() {
    super("Download cancelled");
    this.name = "CancelledError";
  }
}

export async function downloadRegion(options: DownloadOptions): Promise<DownloadResult> {
  const { regionId, bbox, signal, minZoom, maxZoom, onProgress } = options;
  const totalTiles = countTiles(bbox, minZoom, maxZoom);

  await updateRegion(regionId, {
    status: "downloading",
    totalTiles,
    tilesDone: 0,
    actualBytes: 0,
  });

  let tilesDone = 0;
  let bytesDone = 0;
  let lastProgressEmit = 0;

  const emitProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastProgressEmit < PROGRESS_THROTTLE_MS)
      return;
    lastProgressEmit = now;
    onProgress?.({ regionId, tilesDone, totalTiles, bytesDone });
  };

  const checkCancelled = () => {
    if (signal?.aborted)
      throw new CancelledError();
  };

  try {
    let batch: TileInput[] = [];
    const tileIterator = enumerateTiles(bbox, minZoom, maxZoom);

    while (true) {
      checkCancelled();
      const fetchBatch = takeNextBatch(tileIterator, CONCURRENCY);
      if (fetchBatch.length === 0)
        break;

      const fetched = await Promise.all(
        fetchBatch.map(async ({ z, x, y }) => {
          const data = await fetchTileBytes(z, x, y);
          return data ? { regionId, z, x, y, data } : null;
        }),
      );

      for (const item of fetched) {
        if (!item)
          continue;
        batch.push(item);
        bytesDone += item.data.byteLength;
      }
      tilesDone += fetchBatch.length;

      if (batch.length >= BATCH_SIZE) {
        await saveTilesBatch(batch);
        batch = [];
        await updateRegion(regionId, { tilesDone, actualBytes: bytesDone });
      }

      emitProgress();
    }

    if (batch.length > 0)
      await saveTilesBatch(batch);

    await updateRegion(regionId, {
      status: "complete",
      tilesDone,
      actualBytes: bytesDone,
      lastUsed: Date.now(),
    });

    emitProgress(true);
    return { tilesDone, totalTiles, bytesDone, cancelled: false };
  }
  catch (error) {
    if (error instanceof CancelledError) {
      await updateRegion(regionId, { status: "error", tilesDone, actualBytes: bytesDone });
      emitProgress(true);
      return { tilesDone, totalTiles, bytesDone, cancelled: true };
    }

    await updateRegion(regionId, { status: "error", tilesDone, actualBytes: bytesDone });
    emitProgress(true);
    throw error;
  }
}

function takeNextBatch<T>(iterator: Generator<T, void, unknown>, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = iterator.next();
    if (next.done)
      break;
    out.push(next.value);
  }
  return out;
}
