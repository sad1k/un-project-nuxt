import { defineStore } from "pinia";

export type FeedPost = {
  id: number;
  caption: string | null;
  createdAt: number;
  imageKey: string;
  imageDescription: string | null;
  publicPlaceName: string | null;
  publicLat: number | null;
  publicLong: number | null;
  userId: number;
  userName: string;
  userImage: string | null;
  likesCount: number;
  commentsCount: number;
  isLikedByUser: boolean;
};

export type FeedComment = {
  id: number;
  content: string;
  parentId: number | null;
  createdAt: number;
  userId: number;
  userName: string;
  userImage: string | null;
  replyToUserId: number | null;
  replyToUserName: string | null;
};

export type FeedResponse = {
  items: FeedPost[];
  nextCursor: number | null;
  hasMore: boolean;
};

export const useFeedStore = defineStore("feedStore", () => {
  const posts = ref<FeedPost[]>([]);
  const nextCursor = ref<number | null>(null);
  const hasMore = ref(true);
  const loading = ref(false);
  const initialLoading = ref(true);
  const error = ref<string | null>(null);

  const authorId = ref<number | undefined>(undefined);

  async function fetchFeed(reset = false) {
    if (loading.value)
      return;
    if (!reset && !hasMore.value)
      return;

    loading.value = true;
    error.value = null;

    try {
      const cursor = reset ? undefined : nextCursor.value;
      const params = new URLSearchParams();
      if (cursor)
        params.set("cursor", cursor.toString());
      if (authorId.value)
        params.set("author", authorId.value.toString());

      const response = await $fetch<FeedResponse>(`/api/feed?${params.toString()}`);

      if (reset) {
        posts.value = response.items;
      }
      else {
        posts.value = [...posts.value, ...response.items];
      }

      nextCursor.value = response.nextCursor;
      hasMore.value = response.hasMore;
    }
    catch (e) {
      error.value = (e as Error).message || "Ошибка загрузки ленты";
    }
    finally {
      loading.value = false;
      initialLoading.value = false;
    }
  }

  async function likePost(postId: number) {
    const post = posts.value.find(p => p.id === postId);
    if (!post)
      return;

    post.isLikedByUser = true;
    post.likesCount++;

    const queue = useOfflineQueue();
    const pending = usePendingOperationsStore();
    const { response } = await queue.enqueue({
      type: "post.like",
      payload: { postId, action: "like" },
    });
    // 2xx (online) and synthetic 202 (offline-queued) both keep the optimistic state;
    // 4xx means the server rejected (e.g. already liked / unauthorized) so we roll back.
    if (!response.ok && response.status !== 202) {
      post.isLikedByUser = false;
      post.likesCount--;
    }
    await pending.refresh();
  }

  async function unlikePost(postId: number) {
    const post = posts.value.find(p => p.id === postId);
    if (!post)
      return;

    post.isLikedByUser = false;
    post.likesCount--;

    const queue = useOfflineQueue();
    const pending = usePendingOperationsStore();
    const { response } = await queue.enqueue({
      type: "post.like",
      payload: { postId, action: "unlike" },
    });
    if (!response.ok && response.status !== 202) {
      post.isLikedByUser = true;
      post.likesCount++;
    }
    await pending.refresh();
  }

  async function toggleLike(postId: number) {
    const post = posts.value.find(p => p.id === postId);
    if (!post)
      return;

    if (post.isLikedByUser) {
      await unlikePost(postId);
    }
    else {
      await likePost(postId);
    }
  }

  function incrementCommentsCount(postId: number) {
    const post = posts.value.find(p => p.id === postId);
    if (post) {
      post.commentsCount++;
    }
  }

  function decrementCommentsCount(postId: number) {
    const post = posts.value.find(p => p.id === postId);
    if (post && post.commentsCount > 0) {
      post.commentsCount--;
    }
  }

  function setAuthor(id: number | undefined) {
    authorId.value = id;
  }

  function reset() {
    posts.value = [];
    nextCursor.value = null;
    hasMore.value = true;
    loading.value = false;
    initialLoading.value = true;
    error.value = null;
    authorId.value = undefined;
  }

  return {
    posts,
    nextCursor,
    hasMore,
    loading,
    initialLoading,
    error,
    fetchFeed,
    likePost,
    unlikePost,
    authorId,
    toggleLike,
    incrementCommentsCount,
    decrementCommentsCount,
    setAuthor,
    reset,
  };
});
