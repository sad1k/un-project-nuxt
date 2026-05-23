<script lang="ts" setup>
import FeedGlobe from "~/components/feed/feed-globe.client.vue";

const feedStore = useFeedStore();
const authStore = useAuthStore();
const route = useRoute();

const { posts, loading, hasMore, error, initialLoading, authorId } = storeToRefs(feedStore);

const feedContainer = ref<HTMLElement | null>(null);
const activeTab = computed<"feed" | "globe">(() => route.query.tab === "globe" ? "globe" : "feed");
const newPostContent = ref("");

const authorName = computed(() => {
  if (!authorId.value || posts.value.length === 0)
    return null;
  const match = posts.value.find(p => p.userId === authorId.value);
  return match?.userName ?? null;
});

const publishTarget = computed(() => {
  const caption = newPostContent.value.trim();
  return {
    path: "/dashboard/publish",
    query: caption ? { caption } : undefined,
  };
});

function clearAuthorFilter() {
  feedStore.setAuthor(undefined);
  navigateTo("/feed");
  feedStore.fetchFeed(true);
}

watch(() => route.query.author, (val) => {
  const id = val ? Number(val) : undefined;
  feedStore.setAuthor(id && !Number.isNaN(id) ? id : undefined);
  feedStore.fetchFeed(true);
}, { immediate: false });

onMounted(async () => {
  const rawAuthor = route.query.author;
  const id = rawAuthor ? Number(rawAuthor) : undefined;
  if (id && !Number.isNaN(id))
    feedStore.setAuthor(id);
  await feedStore.fetchFeed(true);
});

onUnmounted(() => {
  feedStore.reset();
});

function handleScroll() {
  if (!feedContainer.value)
    return;

  const { scrollTop, scrollHeight, clientHeight } = feedContainer.value;
  const threshold = 200;

  if (activeTab.value === "feed" && scrollHeight - scrollTop - clientHeight < threshold && hasMore.value && !loading.value) {
    feedStore.fetchFeed();
  }
}

async function refreshFeed() {
  await feedStore.fetchFeed(true);
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-gray-50 text-gray-950 transition-colors duration-300 dark:bg-[#050505] dark:text-white">
    <div class="feed-page-tabs pointer-events-none sticky top-16 z-40 flex justify-center px-4 pt-4 md:px-6">
      <div class="pointer-events-auto">
        <FeedViewSwitcher />
      </div>
    </div>

    <div v-if="activeTab === 'globe'" class="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <ClientOnly>
        <div class="feed-globe-background absolute inset-0">
          <FeedGlobe />
        </div>
      </ClientOnly>

      <div class="pointer-events-none relative z-10 flex min-h-[calc(100vh-4rem)] flex-col justify-end px-4 py-5 md:px-6">
        <div class="pointer-events-auto mx-auto w-full max-w-2xl pb-8">
          <div v-if="authStore.user" class="feed-composer feed-composer--floating">
            <div class="flex items-start gap-3">
              <div
                v-if="authStore.user.image"
                class="h-11 w-11 shrink-0 overflow-hidden rounded-full"
              >
                <img
                  :src="authStore.user.image"
                  alt="Avatar"
                  class="h-full w-full object-cover"
                >
              </div>
              <div
                v-else
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-violet to-brand-emerald"
              >
                <span class="text-sm font-bold text-white">{{ authStore.user.name?.charAt(0).toUpperCase() }}</span>
              </div>
              <textarea
                v-model="newPostContent"
                class="min-h-24 flex-1 resize-none bg-transparent text-sm text-gray-950 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder:text-white/45"
                maxlength="500"
                placeholder="Расскажите историю к фото..."
              />
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-gray-200/70 pt-3 dark:border-white/10">
              <span class="text-xs text-gray-500 dark:text-white/45">{{ newPostContent.length }}/500</span>
              <NuxtLink
                :to="publishTarget"
                class="flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-gold/90"
              >
                <Icon name="tabler:photo-plus" size="17" />
                Добавить фото
              </NuxtLink>
            </div>
          </div>

          <NuxtLink
            v-else
            to="/sign-in"
            class="feed-composer feed-composer--floating flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Icon name="tabler:login" size="18" />
            Войти, чтобы создать пост
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-else class="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(31,120,119,0.12),transparent_30%),#f9fafb] dark:bg-[radial-gradient(circle_at_top_right,rgba(31,120,119,0.12),transparent_30%),#050505]">
      <div
        ref="feedContainer"
        class="flex-1 overflow-y-auto px-4 pb-5 pt-24 md:px-6"
        @scroll="handleScroll"
      >
        <div class="mx-auto max-w-2xl">
          <div v-if="authStore.user" class="feed-composer mb-8">
            <div class="flex items-start gap-3">
              <div
                v-if="authStore.user.image"
                class="h-10 w-10 shrink-0 overflow-hidden rounded-full"
              >
                <img
                  :src="authStore.user.image"
                  alt="Avatar"
                  class="h-full w-full object-cover"
                >
              </div>
              <div
                v-else
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-violet to-brand-emerald"
              >
                <span class="text-sm font-bold text-white">{{ authStore.user.name?.charAt(0).toUpperCase() }}</span>
              </div>
              <textarea
                v-model="newPostContent"
                class="min-h-24 flex-1 resize-none bg-transparent py-1 text-sm text-gray-950 placeholder:text-gray-400 focus:outline-none dark:text-white dark:placeholder:text-white/40"
                maxlength="500"
                placeholder="Поделитесь историей к фото..."
              />
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-gray-200/70 pt-3 dark:border-white/10">
              <div class="flex items-center gap-2">
                <NuxtLink
                  to="/dashboard/place-photo/new"
                  class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-emerald dark:hover:bg-white/5"
                  aria-label="Загрузить новое фото"
                >
                  <Icon name="tabler:photo" size="20" />
                </NuxtLink>
                <span class="text-xs text-gray-500 dark:text-white/45">{{ newPostContent.length }}/500</span>
              </div>
              <NuxtLink
                :to="publishTarget"
                class="flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-brand-gold/90"
              >
                Опубликовать
                <Icon name="tabler:send" size="16" />
              </NuxtLink>
            </div>
          </div>

          <div v-if="authorId" class="mb-6 flex items-center gap-3 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3">
            <Icon name="tabler:user" size="18" class="shrink-0 text-brand-gold" />
            <span class="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-white">
              Публикации {{ authorName ?? 'пользователя' }}
            </span>
            <button
              class="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-200 dark:hover:bg-white/10"
              aria-label="Убрать фильтр"
              @click="clearAuthorFilter"
            >
              <Icon name="tabler:x" size="16" />
            </button>
          </div>

          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ authorId ? 'Лента автора' : 'Ваша лента' }}
            </h2>
          </div>

          <div v-if="initialLoading" class="flex flex-col items-center justify-center py-20">
            <span class="loading loading-spinner loading-lg text-brand-gold mb-4" />
            <p class="text-gray-400">
              Загрузка ленты...
            </p>
          </div>

          <div v-else-if="error" class="py-12 text-center">
            <Icon
              name="tabler:alert-circle"
              size="48"
              class="mx-auto mb-4 text-rose-500"
            />
            <p class="text-gray-400">
              {{ error }}
            </p>
            <button
              class="mt-4 rounded-lg bg-brand-gold px-4 py-2 font-semibold text-black transition-colors hover:bg-brand-gold/90"
              @click="refreshFeed"
            >
              Попробовать снова
            </button>
          </div>

          <div v-else-if="posts.length === 0" class="py-16 text-center">
            <div class="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Icon
                name="tabler:photo"
                size="48"
                class="text-brand-gold"
              />
            </div>
            <h2 class="font-semibold tracking-tight mb-2 text-2xl text-gray-900 dark:text-white">
              Пока нет публикаций
            </h2>
            <p class="mx-auto max-w-md text-gray-400">
              Будьте первым, кто поделится своими путешествиями с сообществом!
            </p>
            <NuxtLink
              v-if="authStore.user"
              to="/dashboard/publish"
              class="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-bold text-black transition-opacity hover:opacity-90"
            >
              Создать публикацию
            </NuxtLink>
            <NuxtLink
              v-else
              to="/sign-in"
              class="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 font-bold text-black transition-opacity hover:opacity-90"
            >
              Войти и начать
            </NuxtLink>
          </div>

          <div v-else class="space-y-6">
            <FeedPostCard
              v-for="post in posts"
              :key="post.id"
              :post="post"
            />

            <div v-if="loading" class="flex justify-center py-8">
              <span class="loading loading-spinner loading-lg text-brand-gold" />
            </div>

            <div v-else-if="!hasMore && posts.length > 0" class="py-8 text-center">
              <p class="text-sm text-gray-500">
                Вы просмотрели все публикации
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-headline {
  font-family: "Dela Gothic One", cursive;
}

.feed-page-tabs {
  margin-bottom: -4rem;
}

.feed-composer {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.82);
  padding: 1rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.dark .feed-composer {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(10, 10, 10, 0.58);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
}

.feed-composer--floating {
  background: rgba(255, 255, 255, 0.72);
}

.dark .feed-composer--floating {
  background: rgba(5, 5, 5, 0.54);
}

.feed-globe-background :deep(section) {
  height: 100%;
  min-height: 100%;
  border: 0;
  border-radius: 0;
}
</style>
