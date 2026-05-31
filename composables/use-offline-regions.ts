import type { Bbox } from "~/lib/offline/bbox-from-route";
import type { DownloadProgress, DownloadResult } from "~/lib/offline/region-downloader";
import type { OfflineRegion, OfflineRegionInput } from "~/lib/offline/region-store";

import { downloadRegion as runDownload } from "~/lib/offline/region-downloader";
import {
  addRegion as storeAdd,
  listRegions as storeList,
  removeRegion as storeRemove,
  touchRegion as storeTouch,
} from "~/lib/offline/region-store";

// Module-level singleton — every component that calls useOfflineRegions()
// sees the same reactive list. First client-side caller triggers the
// initial load; subsequent callers reuse the cached state.
//
// `download(regionId, bbox)` runs the real PMTiles fetcher and feeds
// progress updates back into `regionsState`, so any component reading
// from `regions` re-renders as the download advances.

const regionsState = shallowRef<OfflineRegion[]>([]);
const isLoadedState = ref(false);
let loadingPromise: Promise<void> | null = null;
const downloadControllers = new Map<string, AbortController>();

function load(): Promise<void> {
  if (loadingPromise)
    return loadingPromise;
  if (typeof window === "undefined")
    return Promise.resolve();

  loadingPromise = storeList()
    .then((regions) => {
      regionsState.value = regions;
      isLoadedState.value = true;
    })
    .catch((error) => {
      console.error("[offline-regions] failed to load:", error);
      isLoadedState.value = true;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

function patchLocal(id: string, patch: Partial<OfflineRegion>) {
  regionsState.value = regionsState.value.map(region =>
    region.id === id ? { ...region, ...patch } : region,
  );
}

export function useOfflineRegions() {
  if (!isLoadedState.value && !loadingPromise)
    void load();

  async function add(input: OfflineRegionInput): Promise<OfflineRegion> {
    const region = await storeAdd(input);
    regionsState.value = [region, ...regionsState.value];
    return region;
  }

  async function remove(id: string): Promise<void> {
    // If there's an active download for this region, cancel it first
    // so the loop stops touching IndexedDB while we tear the row down.
    cancelDownload(id);
    await storeRemove(id);
    regionsState.value = regionsState.value.filter(region => region.id !== id);
  }

  async function touch(id: string): Promise<void> {
    await storeTouch(id);
    patchLocal(id, { lastUsed: Date.now() });
  }

  async function refresh(): Promise<void> {
    regionsState.value = await storeList();
  }

  async function download(regionId: string, bbox: Bbox): Promise<DownloadResult> {
    if (downloadControllers.has(regionId))
      throw new Error("Region download is already in progress");

    const controller = new AbortController();
    downloadControllers.set(regionId, controller);

    const onProgress = (progress: DownloadProgress) => {
      patchLocal(progress.regionId, {
        status: "downloading",
        tilesDone: progress.tilesDone,
        totalTiles: progress.totalTiles,
        actualBytes: progress.bytesDone,
      });
    };

    try {
      const result = await runDownload({
        regionId,
        bbox,
        signal: controller.signal,
        onProgress,
      });

      patchLocal(regionId, {
        status: result.cancelled ? "error" : "complete",
        tilesDone: result.tilesDone,
        totalTiles: result.totalTiles,
        actualBytes: result.bytesDone,
        lastUsed: Date.now(),
      });

      return result;
    }
    catch (error) {
      patchLocal(regionId, { status: "error" });
      throw error;
    }
    finally {
      downloadControllers.delete(regionId);
    }
  }

  function cancelDownload(regionId: string): void {
    const controller = downloadControllers.get(regionId);
    if (!controller)
      return;
    controller.abort();
    downloadControllers.delete(regionId);
  }

  function isDownloading(regionId: string): boolean {
    return downloadControllers.has(regionId);
  }

  return {
    regions: readonly(regionsState),
    isLoaded: readonly(isLoadedState),
    add,
    remove,
    touch,
    refresh,
    download,
    cancelDownload,
    isDownloading,
  };
}
