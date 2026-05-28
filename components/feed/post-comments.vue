<script lang="ts" setup>
import type { FeedComment } from "~/stores/feed";

const { postId } = defineProps<{
  postId: number;
}>();

const emit = defineEmits<{
  commentAdded: [];
  commentDeleted: [];
}>();

const authStore = useAuthStore();
const { $csrfFetch } = useNuxtApp();
const currentUserId = computed(() => authStore.user?.id as number | undefined);

const comments = ref<FeedComment[]>([]);
const loading = ref(false);
const submitting = ref(false);
const newComment = ref("");
const replyingTo = ref<FeedComment | null>(null);

async function fetchComments() {
  loading.value = true;
  try {
    const data = await $fetch<FeedComment[]>(`/api/posts/${postId}/comments`);
    comments.value = data;
  }
  catch {
    console.error("Ошибка загрузки комментариев");
  }
  finally {
    loading.value = false;
  }
}

async function submitComment() {
  if (!newComment.value.trim() || submitting.value)
    return;

  submitting.value = true;
  try {
    const queue = useOfflineQueue();
    const pending = usePendingOperationsStore();
    const { response } = await queue.enqueue({
      type: "post.comment",
      payload: {
        postId,
        content: newComment.value.trim(),
        parentId: replyingTo.value?.id,
        replyToUserId: replyingTo.value?.userId,
      },
    });

    newComment.value = "";
    replyingTo.value = null;
    // 2xx → refresh comment list with server state.
    // 202 (offline-queued) → leave the input cleared; the optimistic Pinia store shows the pending op.
    if (response.ok && response.status !== 202)
      await fetchComments();
    emit("commentAdded");
    await pending.refresh();
  }
  catch {
    console.error("Ошибка отправки комментария");
  }
  finally {
    submitting.value = false;
  }
}

function handleReply(comment: FeedComment) {
  replyingTo.value = comment;
  newComment.value = "";
}

function cancelReply() {
  replyingTo.value = null;
}

async function handleDelete(commentId: number) {
  try {
    await $csrfFetch(`/api/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
    });
    await fetchComments();
    emit("commentDeleted");
  }
  catch {
    console.error("Ошибка удаления комментария");
  }
}

onMounted(() => {
  fetchComments();
});
</script>

<template>
  <div class="border-t border-gray-200 pt-4 dark:border-white/10">
    <div v-if="loading" class="flex justify-center py-4">
      <span class="loading loading-spinner loading-sm text-brand-gold" />
    </div>

    <div v-else>
      <div v-if="comments.length === 0" class="text-center text-gray-500 py-4 text-sm">
        Пока нет комментариев. Будьте первым!
      </div>

      <div v-else class="divide-y divide-gray-100 max-h-80 overflow-y-auto dark:divide-white/5">
        <FeedCommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :current-user-id="currentUserId"
          @reply="handleReply"
          @delete="handleDelete"
        />
      </div>
    </div>

    <div v-if="currentUserId" class="mt-4">
      <div
        v-if="replyingTo"
        class="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-100 rounded-lg dark:bg-white/5"
      >
        <span class="text-xs text-gray-400">
          Ответ для <span class="text-brand-gold">@{{ replyingTo.userName }}</span>
        </span>
        <button
          class="ml-auto text-gray-500 hover:text-gray-950 dark:hover:text-white"
          @click="cancelReply"
        >
          <Icon name="tabler:x" size="16" />
        </button>
      </div>

      <form class="flex gap-2" @submit.prevent="submitComment">
        <input
          v-model="newComment"
          type="text"
          placeholder="Написать комментарий..."
          class="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-950 text-sm placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors dark:bg-white/5 dark:border-white/10 dark:text-white"
          :disabled="submitting"
        >
        <button
          type="submit"
          class="px-4 py-2 bg-brand-gold text-black font-semibold rounded-lg hover:bg-brand-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!newComment.trim() || submitting"
        >
          <Icon
            v-if="submitting"
            name="tabler:loader-2"
            size="20"
            class="animate-spin"
          />
          <Icon
            v-else
            name="tabler:send"
            size="20"
          />
        </button>
      </form>
    </div>

    <div v-else class="mt-4 text-center">
      <NuxtLink
        to="/sign-in"
        class="text-sm text-brand-gold hover:underline"
      >
        Войдите, чтобы оставить комментарий
      </NuxtLink>
    </div>
  </div>
</template>
