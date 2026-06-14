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
//
// A city region is thousands of range requests against the same-origin
// PMTiles proxy. Over a download that long a single connection routinely
// drops/resets (surfacing as `TypeError: Failed to fetch`) — or the dev
// server briefly chokes — and without tolerance that one blip rejects the
// whole batch and aborts an almost-complete region. So each tile is retried
// a few times with exponential backoff, and concurrency is kept modest to
// avoid hammering the proxy and the browser's per-host connection pool.

export const BATCH_SIZE = 24;
export const CONCURRENCY = 4;
// Per-tile retry budget: total attempts before a tile's failure is fatal to
// the region. 3 → up to two retries after the first try.
export const TILE_FETCH_ATTEMPTS = 3;
// Exponential backoff base between tile retries: 250ms → 500ms → 1s.
export const TILE_RETRY_BASE_MS = 250;
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
          const data = await fetchTileWithRetry(z, x, y, signal);
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

    console.error(
      `[offline-download] region ${regionId} failed after ${tilesDone}/${totalTiles} tiles (${bytesDone} bytes):`,
      error,
    );
    await updateRegion(regionId, { status: "error", tilesDone, actualBytes: bytesDone });
    emitProgress(true);
    throw error;
  }
}

// Fetch a single tile, retrying transient failures with exponential backoff.
// A transient network blip (dropped/reset connection to the tile proxy →
// `TypeError: Failed to fetch`) is retried up to `attempts` times; only after
// the budget is exhausted does the error propagate and fail the region. The
// abort signal short-circuits both the attempt loop and any pending backoff so
// cancellation stays responsive.
export async function fetchTileWithRetry(
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal,
  attempts = TILE_FETCH_ATTEMPTS,
): Promise<Uint8Array | null> {
  for (let attempt = 1; ; attempt += 1) {
    if (signal?.aborted)
      throw new CancelledError();
    try {
      return await fetchTileBytes(z, x, y);
    }
    catch (error) {
      // Out of retries — let the failure abort the region.
      if (attempt >= attempts)
        throw error;
      await delay(TILE_RETRY_BASE_MS * 2 ** (attempt - 1), signal);
    }
  }
}

// Promise-based sleep that rejects with CancelledError the moment the signal
// aborts, so a long backoff never delays a user-requested cancellation.
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CancelledError());
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
