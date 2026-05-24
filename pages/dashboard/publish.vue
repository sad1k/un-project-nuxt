<script lang="ts" setup>
type UserImage = {
  id: number;
  key: string;
  description: string | null;
  createdAt: number;
  isPosted: boolean;
};

const config = useRuntimeConfig();
const { $csrfFetch } = useNuxtApp();
const route = useRoute();

const { data: images, status, refresh } = useFetch<UserImage[]>("/api/posts/my-images", {
  lazy: true,
});

const selectedImage = ref<UserImage | null>(null);
const caption = ref("");
const publishing = ref(false);
const publishError = ref<string | null>(null);
const publishSuccess = ref(false);

onMounted(() => {
  if (typeof route.query.caption === "string")
    caption.value = route.query.caption.slice(0, 500);
});

function selectImage(image: UserImage) {
  if (image.isPosted)
    return;
  selectedImage.value = image;
  publishError.value = null;
  publishSuccess.value = false;
}

function clearSelection() {
  selectedImage.value = null;
  caption.value = "";
  publishError.value = null;
  publishSuccess.value = false;
}

async function publishPost() {
  if (!selectedImage.value || publishing.value)
    return;

  publishing.value = true;
  publishError.value = null;

  try {
    await $csrfFetch("/api/posts", {
      method: "POST",
      body: {
        locationLogImageId: selectedImage.value.id,
        caption: caption.value.trim() || undefined,
      },
    });

    publishSuccess.value = true;
    caption.value = "";
    selectedImage.value = null;
    await refresh();
  }
  catch (e) {
    const error = e as { data?: { message?: string } };
    publishError.value = error.data?.message || "Ошибка публикации";
  }
  finally {
    publishing.value = false;
  }
}
</script>

<template>
  <div class="h-full px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.28em] text-brand-gold/70">
        WanderLog
      </p>
      <h1 class="text-3xl font-display tracking-wide text-gray-950 dark:text-white">
        Опубликовать в ленту
      </h1>
    </div>

    <div v-if="publishSuccess" class="mb-6 rounded-xl border border-green-500/30 bg-green-500/20 p-4">
      <div class="flex items-center gap-3">
        <Icon
          name="tabler:check"
          size="24"
          class="text-green-500"
        />
        <span class="text-green-400">Публикация успешно создана!</span>
        <NuxtLink
          to="/feed"
          class="ml-auto text-sm text-brand-gold hover:underline"
        >
          Перейти в ленту →
        </NuxtLink>
      </div>
    </div>

    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-brand-gold" />
    </div>

    <div v-else-if="!images || images.length === 0" class="text-center py-12">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center">
        <Icon
          name="tabler:photo-off"
          size="40"
          class="text-gray-500"
        />
      </div>
      <p class="text-gray-500 dark:text-gray-400">
        У вас пока нет загруженных изображений
      </p>
      <p class="text-gray-500 text-sm mt-2">
        Добавьте фотографии к своим логам путешествий, чтобы опубликовать их в ленту
      </p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Выберите изображение
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
          <div
            v-for="image in images"
            :key="image.id"
            class="relative aspect-square rounded-xl overflow-hidden cursor-pointer group transition-all duration-200"
            :class="[
              image.isPosted
                ? 'opacity-50 cursor-not-allowed'
                : selectedImage?.id === image.id
                  ? 'ring-2 ring-brand-gold ring-offset-2 ring-offset-gray-50 dark:ring-offset-[#0a0a0a]'
                  : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-white/30',
            ]"
            @click="selectImage(image)"
          >
            <img
              :src="`${config.public.s3BucketUrl}/${image.key}`"
              :alt="image.description || 'Изображение'"
              class="w-full h-full object-cover"
            >
            <div
              v-if="image.isPosted"
              class="absolute inset-0 bg-black/60 flex items-center justify-center"
            >
              <span class="text-xs text-white/80 font-medium px-2 py-1 bg-black/50 rounded">Опубликовано</span>
            </div>
            <div
              v-else-if="selectedImage?.id === image.id"
              class="absolute inset-0 bg-brand-gold/20 flex items-center justify-center"
            >
              <Icon
                name="tabler:check"
                size="32"
                class="text-brand-gold"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedImage" class="h-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/10 backdrop-blur-sm">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Предпросмотр
        </h2>

        <div class="aspect-square rounded-xl overflow-hidden mb-4">
          <img
            :src="`${config.public.s3BucketUrl}/${selectedImage.key}`"
            :alt="selectedImage.description || 'Изображение'"
            class="w-full h-full object-cover"
          >
        </div>

        <div class="mb-4">
          <label class="block text-sm text-gray-500 dark:text-gray-400 mb-2">Подпись (необязательно)</label>
          <textarea
            v-model="caption"
            class="w-full resize-none rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-gray-950 placeholder:text-gray-400 transition-colors focus:border-brand-gold focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
            rows="3"
            placeholder="Добавьте подпись к публикации..."
            maxlength="500"
          />
          <p class="text-xs text-gray-500 mt-1 text-right">
            {{ caption.length }}/500
          </p>
        </div>

        <div v-if="publishError" class="mb-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg">
          <p class="text-sm text-rose-400">
            {{ publishError }}
          </p>
        </div>

        <div class="flex gap-3">
          <button
            class="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-gray-900 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            @click="clearSelection"
          >
            Отмена
          </button>
          <button
            class="flex-1 px-4 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="publishing"
            @click="publishPost"
          >
            <span v-if="publishing" class="flex items-center justify-center gap-2">
              <Icon
                name="tabler:loader-2"
                size="20"
                class="animate-spin"
              />
              Публикация...
            </span>
            <span v-else>Опубликовать</span>
          </button>
        </div>
      </div>

      <div v-else class="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/10 backdrop-blur-sm lg:h-auto">
        <div class="text-center">
          <Icon
            name="tabler:photo-plus"
            size="48"
            class="text-gray-600 mx-auto mb-3"
          />
          <p class="text-gray-500">
            Выберите изображение для публикации
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
