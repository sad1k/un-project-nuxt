<script lang="ts" setup>
const feedStore = useFeedStore();
const authStore = useAuthStore();

const { posts, loading, hasMore, error, initialLoading } = storeToRefs(feedStore);

const feedContainer = ref<HTMLElement | null>(null);
const isSidebarOpen = ref(true);
const activeTab = ref<"latest" | "popular">("latest");
const newPostContent = ref("");

onMounted(async () => {
  isSidebarOpen.value = localStorage.getItem("feedSidebarOpen") !== "false";
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

  if (scrollHeight - scrollTop - clientHeight < threshold && hasMore.value && !loading.value) {
    feedStore.fetchFeed();
  }
}

async function refreshFeed() {
  await feedStore.fetchFeed(true);
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
  localStorage.setItem("feedSidebarOpen", isSidebarOpen.value.toString());
}

const sidebarItems = computed(() => [
  {
    label: "Лента",
    icon: "tabler:home",
    id: "feed",
    href: "/feed",
  },
  {
    label: "Добавить место",
    icon: "tabler:map-pin-plus",
    id: "add-location",
    href: "/dashboard/add",
  },
  {
    label: "Мои места",
    icon: "tabler:map",
    id: "dashboard",
    href: "/dashboard",
  },
  {
    label: "Опубликовать",
    icon: "tabler:send",
    id: "publish",
    href: "/dashboard/publish",
  },
]);
</script>

<template>
  <div class="flex h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-white transition-colors duration-300">
    <div
      class="bg-white dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-white/10 transition-all duration-300 shrink-0 flex flex-col"
      :class="{ 'w-64': isSidebarOpen, 'w-16': !isSidebarOpen }"
    >
      <div
        class="flex hover:cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 p-3 transition-colors border-b border-gray-200 dark:border-white/5"
        :class="{ 'justify-center': !isSidebarOpen, 'justify-between items-center': isSidebarOpen }"
        @click="toggleSidebar"
      >
        <div v-if="isSidebarOpen" class="flex items-center gap-2">
          <Icon
            name="tabler:world"
            size="28"
            class="text-brand-gold"
          />
          <span class="font-headline text-lg">WanderLog</span>
        </div>
        <Icon
          v-if="isSidebarOpen"
          name="tabler:chevron-left"
          size="24"
          class="text-gray-400"
        />
        <Icon
          v-else
          name="tabler:world"
          size="28"
          class="text-brand-gold"
        />
      </div>

      <div class="flex flex-col py-2 flex-1">
        <SidebarButton
          v-for="item in sidebarItems"
          :key="item.id"
          :label="item.label"
          :show-label="isSidebarOpen"
          :icon="item.icon"
          :href="item.href"
          :to="item.href"
        />
      </div>

      <div class="border-t border-gray-200 dark:border-white/5 py-2">
        <SidebarButton
          v-if="authStore.user"
          label="Выйти"
          icon="tabler:logout-2"
          href="/sign-out"
          :show-label="isSidebarOpen"
        />
        <SidebarButton
          v-else
          label="Войти"
          icon="tabler:login"
          href="/sign-in"
          :show-label="isSidebarOpen"
        />
      </div>
    </div>

    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-white/10">
        <div class="max-w-2xl mx-auto">
          <div class="relative">
            <Icon
              name="tabler:search"
              size="20"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Поиск мест, людей или тегов..."
              class="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-[#1a1a1a] border border-transparent dark:border-white/10 rounded-full text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 focus:bg-white dark:focus:bg-[#1a1a1a] transition-colors"
            >
          </div>
        </div>
      </div>

      <div
        ref="feedContainer"
        class="flex-1 overflow-y-auto px-6 py-6"
        @scroll="handleScroll"
      >
        <div class="max-w-2xl mx-auto">
          <div v-if="authStore.user" class="bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-white/10 rounded-2xl p-4 mb-8 shadow-sm dark:shadow-none">
            <div class="flex items-start gap-3">
              <div
                v-if="authStore.user.image"
                class="w-10 h-10 rounded-full overflow-hidden shrink-0"
              >
                <img
                  :src="authStore.user.image"
                  alt="Avatar"
                  class="w-full h-full object-cover"
                >
              </div>
              <div
                v-else
                class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-violet to-brand-emerald flex items-center justify-center shrink-0"
              >
                <span class="text-white font-bold text-sm">{{ authStore.user.name?.charAt(0).toUpperCase() }}</span>
              </div>
              <input
                v-model="newPostContent"
                type="text"
                placeholder="Поделитесь своим приключением..."
                class="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none text-sm py-2"
              >
            </div>
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-white/5">
              <div class="flex items-center gap-1">
                <button class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-cyan-400">
                  <Icon name="tabler:photo" size="20" />
                </button>
                <button class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-cyan-400">
                  <Icon name="tabler:map-pin" size="20" />
                </button>
                <button class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-cyan-400">
                  <Icon name="tabler:mood-smile" size="20" />
                </button>
              </div>
              <NuxtLink
                to="/dashboard/publish"
                class="px-5 py-2 bg-transparent border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white text-sm font-medium rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                Опубликовать
                <Icon name="tabler:send" size="16" />
              </NuxtLink>
            </div>
          </div>

          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              Ваша лента
            </h2>
            <div class="flex items-center gap-2 text-sm">
              <button
                :class="activeTab === 'latest' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'"
                class="transition-colors"
                @click="activeTab = 'latest'"
              >
                Новое
              </button>
              <span class="text-gray-600">•</span>
              <button
                :class="activeTab === 'popular' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'"
                class="transition-colors"
                @click="activeTab = 'popular'"
              >
                Популярное
              </button>
            </div>
          </div>

          <div v-if="initialLoading" class="flex flex-col items-center justify-center py-20">
            <span class="loading loading-spinner loading-lg text-brand-gold mb-4" />
            <p class="text-gray-400">
              Загрузка ленты...
            </p>
          </div>

          <div v-else-if="error" class="text-center py-12">
            <Icon
              name="tabler:alert-circle"
              size="48"
              class="text-rose-500 mx-auto mb-4"
            />
            <p class="text-gray-400">
              {{ error }}
            </p>
            <button
              class="mt-4 px-4 py-2 bg-brand-gold text-black font-semibold rounded-lg hover:bg-brand-gold/90 transition-colors"
              @click="refreshFeed"
            >
              Попробовать снова
            </button>
          </div>

          <div v-else-if="posts.length === 0" class="text-center py-16">
            <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Icon
                name="tabler:photo"
                size="48"
                class="text-brand-gold"
              />
            </div>
            <h2 class="text-2xl font-headline text-gray-900 dark:text-white mb-2">
              Пока нет публикаций
            </h2>
            <p class="text-gray-400 max-w-md mx-auto">
              Будьте первым, кто поделится своими путешествиями с сообществом!
            </p>
            <NuxtLink
              v-if="authStore.user"
              to="/dashboard/publish"
              class="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Создать публикацию
            </NuxtLink>
            <NuxtLink
              v-else
              to="/sign-in"
              class="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
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

            <div v-else-if="!hasMore && posts.length > 0" class="text-center py-8">
              <p class="text-gray-500 text-sm">
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
</style>
