<script lang="ts" setup>
import type { FeedComment } from "~/stores/feed";

const { comment, currentUserId } = defineProps<{
  comment: FeedComment;
  currentUserId?: number;
}>();

const emit = defineEmits<{
  reply: [comment: FeedComment];
  delete: [commentId: number];
}>();

const formattedDate = computed(() => {
  return formatDate(comment.createdAt);
});

const isOwner = computed(() => currentUserId === comment.userId);
</script>

<template>
  <div class="flex gap-3 py-3">
    <div class="shrink-0">
      <div
        v-if="comment.userImage"
        class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-white/10"
      >
        <img
          :src="comment.userImage"
          :alt="comment.userName"
          class="w-full h-full object-cover"
        >
      </div>
      <div
        v-else
        class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-violet to-brand-emerald flex items-center justify-center ring-2 ring-gray-200 dark:ring-white/10"
      >
        <span class="text-white text-xs font-bold">{{ comment.userName.charAt(0).toUpperCase() }}</span>
      </div>
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-semibold text-sm text-gray-950 dark:text-white">{{ comment.userName }}</span>
        <span class="text-xs text-gray-500">{{ formattedDate }}</span>
      </div>

      <p class="text-sm text-gray-700 mt-1 break-words dark:text-gray-300">
        <span
          v-if="comment.replyToUserName"
          class="text-brand-gold font-medium"
        >@{{ comment.replyToUserName }} </span>{{ comment.content }}
      </p>

      <div class="flex items-center gap-3 mt-2">
        <button
          class="text-xs text-gray-500 hover:text-brand-gold transition-colors"
          @click="emit('reply', comment)"
        >
          Ответить
        </button>
        <button
          v-if="isOwner"
          class="text-xs text-gray-500 hover:text-rose-500 transition-colors"
          @click="emit('delete', comment.id)"
        >
          Удалить
        </button>
      </div>
    </div>
  </div>
</template>
