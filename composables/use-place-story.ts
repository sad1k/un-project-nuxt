import type { PlaceStoryRequest, PlaceStoryResponse } from "~/lib/explore/place-story";
import type { RouteMapPoint } from "~/lib/explore/route-map";

type PlaceStoryPlaybackStatus = "idle" | "loading" | "ready" | "generating" | "playing" | "paused" | "ended" | "unavailable" | "error";

type PlaceStoryState = {
  status: PlaceStoryPlaybackStatus;
  story: PlaceStoryResponse | null;
  error: string | null;
  progressSeconds: number;
  durationSeconds: number | null;
};

const audioElements = new Map<string, HTMLAudioElement>();

function createInitialPlaceStoryState(): PlaceStoryState {
  return {
    durationSeconds: null,
    error: null,
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

      setStoryState(key, story);
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

      setStoryState(key, story);

      if (story.audio)
        await playAudio(key, story);
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

    await playAudio(key, story);
  }

  async function replay(request: PlaceStoryRequest | null) {
    if (!request)
      return;

    const key = cacheKey(request);
    const story = getState(request).story;
    if (!story?.audio)
      return;

    const audio = getAudioElement(key, story);
    audio.currentTime = 0;
    await playAudio(key, story);
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
  }

  async function playAudio(key: string, story: PlaceStoryResponse) {
    if (!import.meta.client || !story.audio)
      return;

    pauseOtherStories(key);
    const audio = getAudioElement(key, story);
    await audio.play();
    setState(key, {
      ...getStateFromKey(key),
      error: null,
      status: "playing",
      story,
    });
  }

  function getAudioElement(key: string, story: PlaceStoryResponse) {
    const existing = audioElements.get(key);
    if (existing)
      return existing;

    const audio = new Audio(story.audio?.url);
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
        error: "Story audio could not be played.",
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

  function setStoryState(key: string, story: PlaceStoryResponse) {
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
    cleanup,
    createRequest,
    generateAndPlay,
    getState,
    loadStatus,
    pause,
    replay,
    togglePlayback,
  };
}

function getPlaceStoryError(error: unknown) {
  if (error instanceof Error)
    return error.message;

  return "place_story_unavailable";
}
