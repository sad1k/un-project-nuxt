<script lang="ts" setup>
const emit = defineEmits<{
  (event: "saved", payload: {
    location: { slug: string };
    locationLog: { id: number };
  }): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const capture = usePlacePhotoCapture();
const { $csrfFetch } = useNuxtApp();

const {
  previewUrl,
  confirmedPoint,
  placeName,
  nearbyPlaces,
  loading,
  errorMessage,
  locationAccuracy,
  locationSource,
  saved,
  accuracyLabel,
  canSave,
} = capture;

const publishLoading = ref(false);
const publishError = ref("");
const publishedPostId = ref<number | null>(null);
const canPublishSavedPhoto = computed(() => Boolean(saved.value?.image.id && !publishLoading.value && !publishedPostId.value));

function openCamera() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  capture.selectPhoto(input.files?.[0]);
}

async function onMarkerChanged() {
  capture.locationSource.value = "manual";
  capture.locationAccuracy.value = null;
  await capture.loadNearbyPlaces();
}

async function savePrivatePhoto() {
  await capture.savePrivatePhoto();
}

async function publishSavedPhotoToFeed() {
  if (!saved.value)
    return;

  publishLoading.value = true;
  publishError.value = "";

  try {
    const publicLat = confirmedPoint.value?.lat ?? saved.value.locationLog.lat;
    const publicLong = confirmedPoint.value?.long ?? saved.value.locationLog.long;

    await $csrfFetch(`/api/locations/${saved.value.location.slug}/${saved.value.locationLog.id}/images/${saved.value.image.id}/visibility`, {
      method: "PATCH",
      body: {
        visibility: "public",
        publicPlaceName: placeName.value.trim() || saved.value.locationLog.name,
        publicLat,
        publicLong,
        locationAccuracy: locationAccuracy.value ?? saved.value.locationAccuracy,
        locationSource: locationSource.value ?? saved.value.locationSource,
      },
    });

    const post = await $csrfFetch<{ id: number }>("/api/posts", {
      method: "POST",
      body: {
        locationLogImageId: saved.value.image.id,
      },
    });

    publishedPostId.value = post.id;
  }
  catch (error) {
    publishError.value = error instanceof Error ? error.message : "Не удалось опубликовать фото в ленту";
  }
  finally {
    publishLoading.value = false;
  }
}

function openSavedDiary() {
  if (saved.value)
    emit("saved", saved.value);
}
</script>

<template>
  <section class="page-content-top w-full px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <p class="mb-2 font-mono text-xs uppercase tracking-[0.24em] text-brand-gold/70">
          Фото места
        </p>
        <h1 class="text-2xl font-display text-gray-950 sm:text-3xl dark:text-white">
          Добавить фото из поездки
        </h1>
      </div>
      <NuxtLink class="btn btn-ghost shrink-0 text-gray-600 dark:text-white/70" to="/dashboard">
        <Icon name="tabler:x" size="18" />
      </NuxtLink>
    </div>

    <div v-if="errorMessage" class="alert alert-error mb-4">
      <span>{{ errorMessage }}</span>
    </div>

    <div class="space-y-4 max-w-2xl">
      <div class="rounded-lg p-4">
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept="image/*"
          capture="environment"
          @change="onFileChange"
        >

        <button
          class="btn min-h-14 w-full border-none bg-brand-gold text-brand-dark hover:bg-white"
          type="button"
          :disabled="Boolean(saved)"
          @click="openCamera"
        >
          <Icon name="tabler:camera-plus" size="22" />
          Сделать или выбрать фото
        </button>

        <div v-if="previewUrl" class="mt-4 overflow-hidden rounded-lg">
          <img
            :src="previewUrl"
            alt="Выбранное фото из поездки"
            class="max-h-72 w-full object-contain"
          >
        </div>
      </div>

      <template v-if="!saved">
        <div class="rounded-lg p-4">
          <div class="flex flex-wrap gap-3">
            <button
              class="btn border-none bg-brand-emerald text-white hover:bg-teal-500"
              type="button"
              :disabled="loading"
              @click="capture.requestCurrentPosition"
            >
              <span v-if="loading" class="loading loading-spinner loading-sm" />
              <Icon
                v-else
                name="tabler:current-location"
                size="20"
              />
              Использовать GPS-метку
            </button>
            <button
              class="btn border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
              type="button"
              :disabled="loading"
              @click="capture.setManualPoint(55.755819, 37.617644)"
            >
              <Icon name="tabler:map-pin-plus" size="20" />
              Поставить вручную
            </button>
          </div>
        </div>

        <PlacePhotoLocationConfirmationMap
          v-if="confirmedPoint"
          v-model:point="confirmedPoint"
          :place-name="placeName"
          :accuracy-label="accuracyLabel"
          @changed="onMarkerChanged"
        />

        <div v-if="confirmedPoint" class="rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
          <label class="form-control w-full">
            <span class="label-text mb-2 text-gray-700 dark:text-white/70">Название места</span>
            <input
              v-model="placeName"
              class="input input-bordered w-full border-gray-200 bg-white text-gray-950 dark:border-white/10 dark:bg-black/30 dark:text-white"
              placeholder="Достопримечательность или название места"
            >
          </label>

          <div v-if="nearbyPlaces.length" class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="place in nearbyPlaces"
              :key="place.id"
              type="button"
              class="btn btn-sm border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              @click="capture.applyNearbyPlace(place)"
            >
              <Icon
                name="tabler:map-search"
                size="16"
              />
              {{ place.name }}
            </button>
          </div>
        </div>

        <button
          class="btn min-h-14 w-full border-none bg-brand-sangria text-white hover:bg-rose-600"
          type="button"
          :disabled="!canSave"
          @click="savePrivatePhoto"
        >
          <span v-if="loading" class="loading loading-spinner loading-sm" />
          <Icon
            v-else
            name="tabler:device-floppy"
            size="20"
          />
          Сохранить фото
        </button>
      </template>

      <div v-else class="rounded-lg border border-brand-gold/30 bg-brand-gold/10 p-4">
        <div class="mb-3 flex items-start gap-3">
          <Icon
            name="tabler:circle-check"
            size="22"
            class="mt-0.5 text-brand-gold"
          />
          <div>
            <p class="font-semibold text-gray-950 dark:text-white">
              Фото загружено
            </p>
            <p class="text-sm text-gray-600 dark:text-white/60">
              Теперь можно сразу отправить его в ленту и показать меткой на глобусе.
            </p>
          </div>
        </div>

        <div v-if="publishError" class="alert alert-error mb-3">
          <span>{{ publishError }}</span>
        </div>

        <div v-if="publishedPostId" class="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">
          Фото опубликовано в ленте и появится на live-глобусе.
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            class="btn min-h-12 border-none bg-brand-gold text-brand-dark hover:bg-white"
            type="button"
            :disabled="!canPublishSavedPhoto"
            @click="publishSavedPhotoToFeed"
          >
            <span v-if="publishLoading" class="loading loading-spinner loading-sm" />
            <Icon
              v-else
              name="tabler:world-upload"
              size="20"
            />
            Опубликовать в ленту
          </button>

          <NuxtLink
            v-if="publishedPostId"
            class="btn min-h-12 border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
            to="/feed?tab=globe"
          >
            <Icon name="tabler:world" size="20" />
            Открыть глобус
          </NuxtLink>

          <button
            v-else
            class="btn min-h-12 border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
            type="button"
            @click="openSavedDiary"
          >
            <Icon name="tabler:notebook" size="20" />
            Оставить в дневнике
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
