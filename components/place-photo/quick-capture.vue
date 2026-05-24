<script lang="ts" setup>
import type { SearchLocation } from "~/lib/types";

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

async function onSearchResult(result: SearchLocation) {
  const lat = Number.parseFloat(result.lat);
  const lon = Number.parseFloat(result.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon))
    return;
  capture.setManualPoint(lat, lon);
  placeName.value = result.display_name;
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
  <section class="relative flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden">
    <!-- Sticky header -->
    <header class="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#050505]/95">
      <NuxtLink
        class="app-chrome-control flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
        to="/dashboard"
        aria-label="Закрыть"
        title="Закрыть и вернуться в дашборд"
      >
        <Icon name="tabler:x" size="18" />
      </NuxtLink>
      <div class="min-w-0 flex-1">
        <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-brand-gold/70">
          Фото места
        </p>
        <h1 class="truncate text-base font-bold tracking-tight text-gray-950 sm:text-lg dark:text-white">
          Добавить фото из поездки
        </h1>
      </div>
      <button
        v-if="previewUrl"
        type="button"
        class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10"
        :disabled="Boolean(saved)"
        :title="saved ? 'Фото сохранено' : 'Поменять фото'"
        aria-label="Поменять фото"
        @click="openCamera"
      >
        <img :src="previewUrl" alt="Текущее фото" class="h-full w-full object-cover">
      </button>
      <button
        v-else
        type="button"
        class="btn shrink-0 border-none bg-brand-gold text-brand-dark hover:bg-white"
        title="Сделать или выбрать фото"
        @click="openCamera"
      >
        <Icon name="tabler:camera-plus" size="18" />
        <span class="hidden sm:inline">Фото</span>
      </button>
    </header>

    <input
      ref="fileInput"
      class="hidden"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onFileChange"
    >

    <div v-if="errorMessage" class="alert alert-error m-4 shrink-0">
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Map area takes remaining vertical space -->
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <PlacePhotoLocationConfirmationMap
        v-if="confirmedPoint && !saved"
        v-model:point="confirmedPoint"
        :place-name="placeName"
        :accuracy-label="accuracyLabel"
        class="absolute inset-0 h-full w-full"
        @changed="onMarkerChanged"
      />

      <!-- Empty state: no marker yet -->
      <div
        v-else-if="!saved"
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-emerald/10 via-transparent to-brand-sangria/10 p-6 text-center"
      >
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-emerald/15 text-brand-emerald">
          <Icon name="tabler:map-pin-plus" size="32" />
        </div>
        <div>
          <p class="text-base font-semibold text-gray-900 dark:text-white">
            Где было сделано фото?
          </p>
          <p class="mt-1 text-sm text-gray-600 dark:text-white/60">
            Используйте GPS, найдите место по названию или поставьте метку вручную.
          </p>
        </div>
        <div class="flex w-full max-w-sm flex-col gap-2">
          <button
            class="btn min-h-12 w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20 hover:bg-teal-500"
            type="button"
            :disabled="loading"
            title="Определить местоположение по GPS устройства"
            @click="capture.requestCurrentPosition"
          >
            <span v-if="loading" class="loading loading-spinner loading-sm" />
            <Icon v-else name="tabler:current-location" size="20" />
            Использовать GPS
          </button>
          <button
            class="btn min-h-12 w-full border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
            type="button"
            :disabled="loading"
            title="Поставить маркер в центре карты — потом можно перетащить"
            @click="capture.setManualPoint(55.755819, 37.617644)"
          >
            <Icon name="tabler:map-pin-plus" size="20" />
            Поставить вручную
          </button>
        </div>
      </div>

      <!-- Saved success state replaces map -->
      <div
        v-else
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-gold/15 via-transparent to-brand-emerald/15 p-6 text-center"
      >
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold">
          <Icon name="tabler:circle-check" size="32" />
        </div>
        <p class="text-base font-semibold text-gray-900 dark:text-white">
          Фото загружено
        </p>
        <p class="max-w-xs text-sm text-gray-600 dark:text-white/60">
          Теперь можно отправить его в ленту или оставить в дневнике.
        </p>
      </div>
    </div>

    <!-- Bottom panel: name + save (only when point exists and not saved) -->
    <div
      v-if="confirmedPoint && !saved"
      class="shrink-0 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-[#050505]/95"
    >
      <p class="mb-2 text-xs text-gray-500 dark:text-white/60">
        {{ accuracyLabel }} — перетащите маркер на карте или найдите место ниже.
      </p>

      <div class="mb-3">
        <AppSearchLocations @result-selected="onSearchResult" />
      </div>

      <label class="form-control w-full">
        <input
          v-model="placeName"
          class="input input-bordered w-full border-gray-200 bg-white text-gray-950 dark:border-white/10 dark:bg-black/30 dark:text-white"
          placeholder="Или впишите название места"
          title="Название места — будет показано на карте и в ленте"
        >
      </label>

      <div v-if="nearbyPlaces.length" class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="place in nearbyPlaces"
          :key="place.id"
          type="button"
          class="btn btn-sm border-gray-200 bg-gray-100 text-gray-900 hover:bg-gray-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          :title="`Применить: ${place.name}`"
          @click="capture.applyNearbyPlace(place)"
        >
          <Icon name="tabler:map-search" size="14" />
          {{ place.name }}
        </button>
      </div>

      <button
        class="btn mt-3 min-h-12 w-full border-none bg-brand-sangria text-white shadow-lg shadow-brand-sangria/25 hover:bg-rose-600"
        type="button"
        :disabled="!canSave"
        :title="canSave ? 'Сохранить фото и метку' : 'Сначала выберите фото и место'"
        @click="savePrivatePhoto"
      >
        <span v-if="loading" class="loading loading-spinner loading-sm" />
        <Icon v-else name="tabler:device-floppy" size="20" />
        Сохранить фото
      </button>
    </div>

    <!-- Saved success actions -->
    <div
      v-else-if="saved"
      class="shrink-0 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-[#050505]/95"
    >
      <div v-if="publishError" class="alert alert-error mb-3">
        <span>{{ publishError }}</span>
      </div>

      <div v-if="publishedPostId" class="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">
        Фото опубликовано в ленте и появится на live-глобусе.
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <button
          class="btn min-h-12 border-none bg-brand-gold text-brand-dark hover:bg-white"
          type="button"
          :disabled="!canPublishSavedPhoto"
          title="Сделать фото публичным — оно попадёт в ленту и на live-глобус"
          @click="publishSavedPhotoToFeed"
        >
          <span v-if="publishLoading" class="loading loading-spinner loading-sm" />
          <Icon v-else name="tabler:world-upload" size="20" />
          В ленту
        </button>

        <NuxtLink
          v-if="publishedPostId"
          class="btn min-h-12 border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
          to="/feed?tab=globe"
          title="Открыть live-глобус — увидите новую точку"
        >
          <Icon name="tabler:world" size="20" />
          Глобус
        </NuxtLink>

        <button
          v-else
          class="btn min-h-12 border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
          type="button"
          title="Оставить фото приватным в дневнике"
          @click="openSavedDiary"
        >
          <Icon name="tabler:notebook" size="20" />
          В дневник
        </button>
      </div>
    </div>
  </section>
</template>
