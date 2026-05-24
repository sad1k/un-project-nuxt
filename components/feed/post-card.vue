<script lang="ts" setup>
import VueEasyLightbox from "vue-easy-lightbox";

import type { FeedPost } from "~/stores/feed";

const { post } = defineProps<{
  post: FeedPost;
}>();

const config = useRuntimeConfig();
const authStore = useAuthStore();
const feedStore = useFeedStore();

const isLoggedIn = computed(() => !!authStore.user);
const showComments = ref(false);

const imageUrl = computed(() => `${config.public.s3BucketUrl}/${post.imageKey}`);

const formattedDate = computed(() => {
  return formatDate(post.createdAt);
});

const placeLabel = computed(() => post.publicPlaceName || "Место поездки");

const visibleRef = ref(false);

function openLightbox() {
  visibleRef.value = true;
}

function onHide() {
  visibleRef.value = false;
}

function handleLikeToggle() {
  if (!isLoggedIn.value) {
    navigateTo("/sign-in");
    return;
  }
  feedStore.toggleLike(post.id);
}

function toggleComments() {
  showComments.value = !showComments.value;
}

function handleCommentAdded() {
  feedStore.incrementCommentsCount(post.id);
}

function handleCommentDeleted() {
  feedStore.decrementCommentsCount(post.id);
}

const captionWithHighlightedTags = computed(() => {
  if (!post.caption)
    return "";
  return post.caption.replace(/(#\w+)/g, "<span class=\"text-cyan-400\">$1</span>");
});
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-[#0d0d0d]">
    <div class="p-4 flex items-center gap-3">
      <div class="relative">
        <div
          v-if="post.userImage"
          class="w-11 h-11 rounded-full overflow-hidden"
        >
          <img
            :src="post.userImage"
            :alt="post.userName"
            class="w-full h-full object-cover"
          >
        </div>
        <div
          v-else
          class="w-11 h-11 rounded-full bg-gradient-to-br from-brand-violet to-brand-emerald flex items-center justify-center"
        >
          <span class="text-white font-bold">{{ post.userName.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0d0d0d]">
          <Icon
            name="tabler:check"
            size="10"
            class="text-white"
          />
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="truncate font-semibold text-gray-950 dark:text-white">
          {{ post.userName }}
        </h3>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <time>{{ formattedDate }}</time>
          <span aria-hidden="true" class="text-gray-300 dark:text-white/20">•</span>
          <div class="feed-post-place flex min-w-0 items-center gap-1 text-cyan-500 dark:text-cyan-400">
            <Icon name="tabler:map-pin" size="12" class="shrink-0" />
            <span class="truncate">{{ placeLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="post.caption" class="px-4 pb-3">
      <p class="text-gray-700 text-sm leading-relaxed dark:text-gray-200" v-html="captionWithHighlightedTags" />
    </div>

    <div
      class="relative cursor-pointer group"
      @click="openLightbox"
    >
      <img
        :src="imageUrl"
        :alt="post.imageDescription || 'Фото'"
        class="w-full aspect-[4/3] object-cover group-hover:opacity-95 transition-opacity"
      >
    </div>

    <div class="p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-5">
          <button
            class="flex items-center gap-2 text-gray-400 hover:text-rose-500 transition-colors group"
            @click="handleLikeToggle"
          >
            <Icon
              :name="post.isLikedByUser ? 'tabler:heart-filled' : 'tabler:heart'"
              size="22"
              :class="post.isLikedByUser ? 'text-rose-500' : ''"
            />
            <span class="text-sm">{{ post.likesCount }}</span>
          </button>

          <button
            class="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
            @click="toggleComments"
          >
            <Icon name="tabler:message-circle" size="22" />
            <span class="text-sm">{{ post.commentsCount }}</span>
          </button>
        </div>

        <button class="text-gray-400 hover:text-brand-gold transition-colors">
          <Icon name="tabler:bookmark" size="22" />
        </button>
      </div>

      <FeedPostComments
        v-if="showComments"
        :post-id="post.id"
        class="mt-4 pt-4 border-t border-gray-200 dark:border-white/10"
        @comment-added="handleCommentAdded"
        @comment-deleted="handleCommentDeleted"
      />
    </div>

    <VueEasyLightbox
      :visible="visibleRef"
      :imgs="[imageUrl]"
      :index="0"
      @hide="onHide"
    />
  </article>
</template>
