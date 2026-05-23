import {
  type FeedGlobeDensityPoint,
  type FeedGlobeOverflowIndicator,
  limitFeedGlobeDensity,
} from "~/lib/feed/globe-density";

export type PublicFeedGlobePost = {
  id: number;
  caption: string | null;
  createdAt: number;
  image: {
    url: string;
    alt: string;
  };
  place: {
    name: string;
    lat: number;
    long: number;
  };
  author: {
    name: string;
    image: string | null;
  };
};

type FeedGlobeResponse = {
  posts: PublicFeedGlobePost[];
  nextSince: number;
};

export type FeedGlobeRenderPoint = FeedGlobeDensityPoint & {
  post: PublicFeedGlobePost;
};

export function useFeedGlobe() {
  const posts = ref<PublicFeedGlobePost[]>([]);
  const visiblePoints = ref<FeedGlobeRenderPoint[]>([]);
  const hiddenPointIds = ref<number[]>([]);
  const fadingPointIds = ref<number[]>([]);
  const overflowIndicators = ref<FeedGlobeOverflowIndicator[]>([]);
  const selectedPost = ref<PublicFeedGlobePost | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const nextSince = ref(0);
  const liveConnected = ref(false);
  const polling = ref(false);

  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<FeedGlobeResponse>("/api/public/feed-globe");
      mergePosts(response.posts);
      nextSince.value = response.nextSince;
    }
    catch (e) {
      error.value = (e as Error).message || "Не удалось загрузить глобус ленты";
    }
    finally {
      loading.value = false;
    }
  }

  function mergePosts(incomingPosts: PublicFeedGlobePost[]) {
    const byId = new Map<number, PublicFeedGlobePost>();
    for (const post of posts.value)
      byId.set(post.id, post);
    for (const post of incomingPosts)
      byId.set(post.id, post);

    posts.value = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    applyDensity();
  }

  async function fetchNewPosts() {
    const params = new URLSearchParams();
    params.set("since", nextSince.value.toString());
    const response = await $fetch<FeedGlobeResponse>(`/api/public/feed-globe?${params.toString()}`);
    mergePosts(response.posts);
    nextSince.value = Math.max(nextSince.value, response.nextSince);
  }

  function startLiveUpdates() {
    if (typeof EventSource === "undefined") {
      startPollingFallback();
      return;
    }

    stopLiveUpdates();
    eventSource = new EventSource(`/api/public/feed-globe/stream?since=${nextSince.value}`);

    eventSource.onopen = () => {
      liveConnected.value = true;
      stopPollingFallback();
    };

    eventSource.onmessage = (message) => {
      const payload = JSON.parse(message.data) as FeedGlobeResponse;
      mergePosts(payload.posts);
      nextSince.value = Math.max(nextSince.value, payload.nextSince);
    };

    eventSource.onerror = () => {
      liveConnected.value = false;
      eventSource?.close();
      eventSource = null;
      startPollingFallback();
    };
  }

  function startPollingFallback() {
    if (pollTimer)
      return;

    polling.value = true;
    pollTimer = setInterval(() => {
      fetchNewPosts().catch(() => {});
    }, 5000);
  }

  function stopPollingFallback() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    polling.value = false;
  }

  function stopLiveUpdates() {
    eventSource?.close();
    eventSource = null;
    liveConnected.value = false;
    stopPollingFallback();
  }

  function applyDensity() {
    const density = limitFeedGlobeDensity(posts.value.map(post => ({
      id: post.id,
      createdAt: post.createdAt,
      lat: post.place.lat,
      long: post.place.long,
      post,
    })));

    visiblePoints.value = density.visiblePoints;
    hiddenPointIds.value = density.hiddenPointIds;
    fadingPointIds.value = density.fadingPointIds;
    overflowIndicators.value = density.overflowIndicators;
  }

  function selectPost(post: PublicFeedGlobePost | null) {
    selectedPost.value = post;
  }

  return {
    posts,
    visiblePoints,
    hiddenPointIds,
    fadingPointIds,
    overflowIndicators,
    selectedPost,
    loading,
    error,
    nextSince,
    liveConnected,
    polling,
    refresh,
    mergePosts,
    fetchNewPosts,
    startLiveUpdates,
    stopLiveUpdates,
    selectPost,
  };
}
