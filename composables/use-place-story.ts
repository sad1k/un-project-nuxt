import type { PlaceStoryRequest, PlaceStoryResponse } from "~/lib/explore/place-story";
import type { RouteMapPoint } from "~/lib/explore/route-map";

type PlaceStoryPlaybackStatus = "idle" | "loading" | "ready" | "generating" | "playing" | "paused" | "ended" | "unavailable" | "error";
type PlaceStoryOfflineStatus = "checking" | "not_saved" | "saving" | "saved" | "removing" | "unsupported" | "unavailable_offline" | "error";

type PlaceStoryState = {
  status: PlaceStoryPlaybackStatus;
  offlineStatus: PlaceStoryOfflineStatus;
  story: PlaceStoryResponse | null;
  error: string | null;
  progressSeconds: number;
  durationSeconds: number | null;
};

const PLACE_STORY_AUDIO_CACHE_NAME = "wanderlog-place-story-audio-v1";
const audioElements = new Map<string, HTMLAudioElement>();
const cachedObjectUrls = new Map<string, string>();

function createInitialPlaceStoryState(): PlaceStoryState {
  return {
    durationSeconds: null,
    error: null,
    offlineStatus: "not_saved",
    progressSeconds: 0,
    status: "idle",
    story: null,
  };
}

export function usePlaceStory() {
  const cache = useState<Record<string, PlaceStoryState>>("explore-place-story-cache", () => ({}));

  function createRequest(input: {
    point: RouteMapPoint | null | undefined;
    sessionId: number | null | undefined;
    variantId: number | null | undefined;
  }): PlaceStoryRequest | null {
    if (!input.point || input.point.markerKind !== "generated" || !input.sessionId || !input.variantId)
      return null;

    return {
      routePointId: input.point.sourceId,
      sessionId: input.sessionId,
      variantId: input.variantId,
    };
  }

  function cacheKey(request: PlaceStoryRequest | null | undefined) {
    if (!request)
      return "missing";

    return `${request.sessionId}:${request.variantId}:${request.routePointId}`;
  }

  function getState(request: PlaceStoryRequest | null | undefined) {
    return cache.value[cacheKey(request)] || createInitialPlaceStoryState();
  }

  async function loadStatus(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    setState(key, {
      ...getState(request),
      error: null,
      status: "loading",
    });

    try {
      const story = await $fetch<PlaceStoryResponse>("/api/explore/place-story", {
        query: request,
      });

      setStoryState(key, request, story);
    }
    catch (caughtError) {
      setState(key, {
        ...getState(request),
        error: getPlaceStoryError(caughtError),
        status: "error",
      });
    }
  }

  async function generateAndPlay(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    if (isBrowserOffline()) {
      markOfflineUnavailable(key);
      return;
    }

    pauseOtherStories(key);
    setState(key, {
      ...getState(request),
      error: null,
      status: "generating",
    });

    try {
      const { csrf } = useCsrf();
      const story = await $fetch<PlaceStoryResponse>("/api/explore/place-story/generate", {
        body: request,
        headers: csrf ? { "csrf-token": csrf } : undefined,
        method: "POST",
      });

      setStoryState(key, request, story);

      if (story.audio)
        await playAudio(key, request, story);
    }
    catch (caughtError) {
      setState(key, {
        ...getState(request),
        error: getPlaceStoryError(caughtError),
        status: "error",
      });
    }
  }

  async function togglePlayback(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    const state = getState(request);
    const story = state.story;

    if (!story?.audio) {
      await generateAndPlay(request);
      return;
    }

    const audio = audioElements.get(key);
    if (audio && !audio.paused) {
      audio.pause();
      setState(key, {
        ...state,
        status: "paused",
      });
      return;
    }

    await playAudio(key, request, story);
  }

  async function replay(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    const story = getState(request).story;
    if (!story?.audio)
      return;

    const sourceUrl = await resolvePlaybackUrl(key, request, story);
    if (!sourceUrl)
      return;

    const audio = getAudioElement(key, sourceUrl);
    audio.currentTime = 0;
    await playAudio(key, request, story);
  }

  async function saveOffline(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    const story = getState(request).story;
    if (!story?.audio)
      return;

    if (!hasCacheStorageSupport()) {
      setState(key, {
        ...getState(request),
        error: "Offline audio saving is not supported in this browser.",
        offlineStatus: "unsupported",
      });
      return;
    }

    setState(key, {
      ...getState(request),
      error: null,
      offlineStatus: "saving",
    });

    try {
      const response = await fetch(story.audio.url, { credentials: "same-origin" });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("audio"))
        throw new Error("invalid_story_audio_response");

      const cacheStorage = await window.caches.open(PLACE_STORY_AUDIO_CACHE_NAME);
      await cacheStorage.put(createOfflineCacheRequest(story), response.clone());
      setState(key, {
        ...getState(request),
        error: null,
        offlineStatus: "saved",
      });
    }
    catch (caughtError) {
      setState(key, {
        ...getState(request),
        error: getPlaceStoryError(caughtError),
        offlineStatus: "error",
      });
    }
  }

  async function removeOffline(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    const story = getState(request).story;
    if (!story?.audio || !hasCacheStorageSupport())
      return;

    setState(key, {
      ...getState(request),
      offlineStatus: "removing",
    });

    const cacheStorage = await window.caches.open(PLACE_STORY_AUDIO_CACHE_NAME);
    await cacheStorage.delete(createOfflineCacheRequest(story));
    revokeCachedObjectUrl(key);
    setState(key, {
      ...getState(request),
      error: null,
      offlineStatus: "not_saved",
    });
  }

  async function checkOfflineAvailability(request: PlaceStoryRequest | null, story = request ? getState(request).story : null) {
    if (!request || !story?.audio)
      return;

    const key = cacheKey(request);
    if (!hasCacheStorageSupport()) {
      setState(key, {
        ...getState(request),
        offlineStatus: "unsupported",
      });
      return;
    }

    setState(key, {
      ...getState(request),
      offlineStatus: "checking",
    });

    const cacheStorage = await window.caches.open(PLACE_STORY_AUDIO_CACHE_NAME);
    const cached = await cacheStorage.match(createOfflineCacheRequest(story));
    setState(key, {
      ...getState(request),
      offlineStatus: cached ? "saved" : "not_saved",
    });
  }

  function pause(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    audioElements.get(key)?.pause();
    setState(key, {
      ...getState(request),
      status: "paused",
    });
  }

  function cleanup(request: PlaceStoryRequest | null) {
    const key = cacheKey(request);
    const audio = audioElements.get(key);
    if (!audio)
      return;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audioElements.delete(key);
    revokeCachedObjectUrl(key);
  }

  async function playAudio(key: string, request: PlaceStoryRequest, story: PlaceStoryResponse) {
    if (!import.meta.client || !story.audio)
      return;

    pauseOtherStories(key);
    const sourceUrl = await resolvePlaybackUrl(key, request, story);
    if (!sourceUrl)
      return;

    const audio = getAudioElement(key, sourceUrl);
    await audio.play();
    setState(key, {
      ...getStateFromKey(key),
      error: null,
      status: "playing",
      story,
    });
  }

  async function resolvePlaybackUrl(key: string, request: PlaceStoryRequest, story: PlaceStoryResponse) {
    if (!story.audio)
      return null;

    if (!isBrowserOffline())
      return story.audio.url;

    if (!hasCacheStorageSupport()) {
      markOfflineUnavailable(key);
      return null;
    }

    const cacheStorage = await window.caches.open(PLACE_STORY_AUDIO_CACHE_NAME);
    const cached = await cacheStorage.match(createOfflineCacheRequest(story));
    if (!cached) {
      markOfflineUnavailable(key);
      return null;
    }

    const objectUrl = URL.createObjectURL(await cached.blob());
    revokeCachedObjectUrl(key);
    cachedObjectUrls.set(key, objectUrl);
    setState(key, {
      ...getState(request),
      error: null,
      offlineStatus: "saved",
    });
    return objectUrl;
  }

  function getAudioElement(key: string, sourceUrl: string) {
    const existing = audioElements.get(key);
    if (existing) {
      if (existing.src !== sourceUrl)
        existing.src = sourceUrl;

      return existing;
    }

    const audio = new Audio(sourceUrl);
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", () => {
      setState(key, {
        ...getStateFromKey(key),
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : null,
        progressSeconds: audio.currentTime,
      });
    });
    audio.addEventListener("loadedmetadata", () => {
      setState(key, {
        ...getStateFromKey(key),
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : null,
      });
    });
    audio.addEventListener("ended", () => {
      setState(key, {
        ...getStateFromKey(key),
        status: "ended",
      });
    });
    audio.addEventListener("error", () => {
      setState(key, {
        ...getStateFromKey(key),
        error: "Не удалось воспроизвести аудиоисторию.",
        status: "error",
      });
    });
    audioElements.set(key, audio);
    return audio;
  }

  function pauseOtherStories(activeKey: string) {
    for (const [key, audio] of audioElements.entries()) {
      if (key === activeKey)
        continue;

      audio.pause();
      const state = getStateFromKey(key);
      if (state.status === "playing") {
        setState(key, {
          ...state,
          status: "paused",
        });
      }
    }
  }

  function setStoryState(key: string, request: PlaceStoryRequest, story: PlaceStoryResponse) {
    setState(key, {
      ...getStateFromKey(key),
      error: null,
      story,
      status: story.status === "available"
        ? "ready"
        : story.status === "unavailable"
          ? "unavailable"
          : story.status === "failed"
            ? "error"
            : story.status,
    });

    if (story.audio)
      void checkOfflineAvailability(request, story);
  }

  function markOfflineUnavailable(key: string) {
    setState(key, {
      ...getStateFromKey(key),
      error: "Story was not saved offline.",
      offlineStatus: "unavailable_offline",
      status: "unavailable",
    });
  }

  function getStateFromKey(key: string) {
    return cache.value[key] || createInitialPlaceStoryState();
  }

  function setState(key: string, state: PlaceStoryState) {
    cache.value = {
      ...cache.value,
      [key]: state,
    };
  }

  return {
    cache,
    cacheKey,
    checkOfflineAvailability,
    cleanup,
    createRequest,
    generateAndPlay,
    getState,
    loadStatus,
    pause,
    removeOffline,
    replay,
    saveOffline,
    togglePlayback,
  };
}

function getPlaceStoryError(error: unknown) {
  if (error instanceof Error)
    return error.message;

  return "place_story_unavailable";
}

function hasCacheStorageSupport() {
  return import.meta.client && "caches" in window;
}

function isBrowserOffline() {
  return import.meta.client && window.navigator.onLine === false;
}

function createOfflineCacheRequest(story: PlaceStoryResponse) {
  return new Request(new URL(story.audio?.url || "/", window.location.origin).toString(), {
    credentials: "same-origin",
  });
}

function revokeCachedObjectUrl(key: string) {
  const objectUrl = cachedObjectUrls.get(key);
  if (!objectUrl)
    return;

  URL.revokeObjectURL(objectUrl);
  cachedObjectUrls.delete(key);
}
