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

const { isOnline, isOffline } = useOnline();

const publishLoading = ref(false);
const publishError = ref("");
const publishedPostId = ref<number | null>(null);
const caption = ref("");
const CAPTION_MAX = 500;
const captionCharsLeft = computed(() => CAPTION_MAX - caption.value.length);
const canPublishSavedPhoto = computed(() => Boolean(
  saved.value?.image.id
  && !publishLoading.value
  && !publishedPostId.value
  && caption.value.length <= CAPTION_MAX
  && isOnline.value,
));

const hasPhoto = computed(() => Boolean(previewUrl.value));
const hasPoint = computed(() => Boolean(confirmedPoint.value));

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

async function onSearchSelected(result: SearchLocation) {
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

    const trimmedCaption = caption.value.trim();
    const post = await $csrfFetch<{ id: number }>("/api/posts", {
      method: "POST",
      body: {
        locationLogImageId: saved.value.image.id,
        ...(trimmedCaption ? { caption: trimmedCaption } : {}),
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

function startAnotherCapture() {
  publishLoading.value = false;
  publishError.value = "";
  publishedPostId.value = null;
  caption.value = "";
  capture.resetForNewCapture();
}
</script>

<template>
  <section class="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-[#050505]">
    <!-- Background full-screen map -->
    <PlacePhotoLocationConfirmationMap
      v-model:point="confirmedPoint"
      :place-name="placeName"
      :accuracy-label="accuracyLabel"
      class="absolute inset-0 h-full w-full"
      @changed="onMarkerChanged"
    />

    <!-- Subtle gradient to keep cards readable over light map areas -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-[1] h-40 bg-gradient-to-b from-black/55 via-black/20 to-transparent" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-72 bg-gradient-to-t from-black/65 via-black/35 to-transparent" />

    <!-- Floating header -->
    <header class="absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 sm:p-4">
      <NuxtLink
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/55 text-white/90 shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-white/25 hover:bg-black/70 hover:text-white"
        to="/dashboard"
        aria-label="Закрыть"
        title="Закрыть и вернуться в дашборд"
      >
        <Icon name="tabler:x" size="18" />
      </NuxtLink>

      <div class="min-w-0 flex-1 rounded-2xl border border-white/12 bg-black/55 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
        <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-brand-gold/75">
          Фото места
        </p>
        <h1 class="truncate text-base font-bold tracking-tight text-white sm:text-lg">
          Добавить фото из поездки
        </h1>
      </div>
    </header>

    <input
      ref="fileInput"
      class="hidden"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onFileChange"
    >

    <!-- Floating search autocomplete -->
    <div class="pointer-events-none absolute inset-x-0 top-[5.25rem] z-20 flex justify-center px-3 sm:top-24 sm:px-4">
      <div class="pointer-events-auto w-full max-w-md">
        <PlacePhotoPlaceAutocomplete @selected="onSearchSelected" />
      </div>
    </div>

    <!-- Error toast -->
    <div
      v-if="errorMessage"
      class="absolute inset-x-3 top-44 z-30 mx-auto max-w-md rounded-xl border border-rose-500/40 bg-rose-950/85 px-4 py-2.5 text-sm text-rose-100 shadow-lg shadow-rose-950/40 backdrop-blur-md sm:inset-x-4"
      role="alert"
    >
      <div class="flex items-start gap-2">
        <Icon
          name="tabler:alert-triangle"
          size="18"
          class="mt-0.5 shrink-0"
        />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <!-- Bottom action card: pre-save flow -->
    <div
      v-if="!saved"
      class="absolute inset-x-0 bottom-20 z-20 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-4 sm:px-4"
    >
      <div class="w-full max-w-2xl rounded-3xl border border-white/12 bg-black/72 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-4">
        <!-- Status row -->
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
              :class="hasPhoto
                ? 'border-brand-gold/45 bg-brand-gold/15 text-brand-gold'
                : 'border-white/15 bg-white/5 text-white/55'"
            >
              <Icon :name="hasPhoto ? 'tabler:photo-check' : 'tabler:photo-plus'" size="14" />
              {{ hasPhoto ? "Фото готово" : "Фото не выбрано" }}
            </span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
              :class="hasPoint
                ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200'
                : 'border-white/15 bg-white/5 text-white/55'"
            >
              <Icon :name="hasPoint ? 'tabler:map-pin-check' : 'tabler:map-pin-plus'" size="14" />
              {{ hasPoint ? accuracyLabel : "Метка не задана" }}
            </span>
          </div>

          <button
            v-if="hasPhoto"
            type="button"
            class="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-brand-gold/40 shadow-md shadow-black/40 transition hover:scale-[1.03] hover:border-brand-gold/70"
            title="Поменять фото"
            aria-label="Поменять фото"
            @click="openCamera"
          >
            <img
              :src="previewUrl!"
              alt="Текущее фото"
              class="h-full w-full object-cover"
            >
            <span class="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/75 to-transparent py-0.5">
              <Icon
                name="tabler:edit"
                size="10"
                class="text-white"
              />
            </span>
          </button>
          <button
            v-else
            type="button"
            class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-brand-gold/45 bg-brand-gold/95 px-3 text-xs font-semibold text-brand-dark shadow-md shadow-brand-gold/20 transition hover:bg-brand-gold"
            title="Сделать или выбрать фото"
            @click="openCamera"
          >
            <Icon name="tabler:camera-plus" size="16" />
            Фото
          </button>
        </div>

        <!-- Step 1: place a marker (when no point) -->
        <div v-if="!hasPoint" class="flex flex-col gap-2">
          <p class="text-xs text-white/65 sm:text-sm">
            Найдите место поиском, по GPS или поставьте метку двойным кликом по карте.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-none bg-brand-emerald px-3 text-sm font-semibold text-white shadow-md shadow-brand-emerald/25 transition hover:bg-teal-500 disabled:opacity-60"
              type="button"
              :disabled="loading"
              title="Определить местоположение по GPS устройства"
              @click="capture.requestCurrentPosition"
            >
              <span v-if="loading" class="loading loading-spinner loading-sm" />
              <Icon
                v-else
                name="tabler:current-location"
                size="18"
              />
              GPS
            </button>
            <button
              class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 text-sm font-semibold text-white shadow-md shadow-black/30 transition hover:border-brand-gold/45 hover:bg-white/12 hover:text-brand-gold disabled:opacity-60"
              type="button"
              :disabled="loading"
              title="Поставить маркер в центре карты — потом можно перетащить"
              @click="capture.setManualPoint(55.755819, 37.617644)"
            >
              <Icon name="tabler:map-pin-plus" size="18" />
              Вручную
            </button>
          </div>
        </div>

        <!-- Step 2: confirm and save (when point set) -->
        <div v-else class="flex flex-col gap-2.5">
          <label class="form-control w-full">
            <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-white/55">
              Название места
            </span>
            <input
              v-model="placeName"
              class="input h-11 w-full rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/35 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
              placeholder="Например: Эрмитаж, кафе на берегу..."
              title="Название места — будет показано на карте и в ленте"
            >
          </label>

          <div v-if="nearbyPlaces.length" class="flex flex-wrap gap-1.5">
            <span class="self-center text-[11px] uppercase tracking-wider text-white/45">
              Поблизости:
            </span>
            <button
              v-for="place in nearbyPlaces"
              :key="place.id"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-xs text-white transition hover:border-brand-gold/55 hover:bg-brand-gold/15 hover:text-brand-gold"
              :title="`Применить: ${place.name}`"
              @click="capture.applyNearbyPlace(place)"
            >
              <Icon name="tabler:map-search" size="12" />
              {{ place.name }}
            </button>
          </div>

          <OfflineUnavailable
            v-if="isOffline"
            feature="photo-upload-save"
            label="Загрузка фото"
            icon="tabler:cloud-off"
            variant="inline"
            reason="Сохраним, когда появится сеть"
            class="mt-1 flex justify-center"
          />
          <button
            v-else
            class="btn mt-1 h-12 w-full border-none bg-brand-sangria text-white shadow-lg shadow-brand-sangria/25 hover:bg-rose-600 disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
            type="button"
            :disabled="!canSave"
            :title="canSave ? 'Сохранить фото и метку' : !hasPhoto ? 'Сначала добавьте фото' : 'Введите название места'"
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
        </div>
      </div>
    </div>

    <!-- Saved success card -->
    <div
      v-else
      class="absolute inset-x-0 bottom-20 z-20 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-4 sm:px-4"
    >
      <div class="w-full max-w-2xl rounded-3xl border border-brand-gold/30 bg-black/78 p-4 shadow-2xl shadow-brand-gold/10 backdrop-blur-xl">
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold">
            <Icon name="tabler:circle-check" size="24" />
          </div>
          <div class="min-w-0">
            <p class="text-base font-semibold text-white">
              Фото загружено
            </p>
            <p class="truncate text-sm text-white/65">
              Опубликуйте его в ленте или оставьте в дневнике
            </p>
          </div>
        </div>

        <label v-if="!publishedPostId" class="form-control mb-3 w-full">
          <span class="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/55">
            <span>Подпись для ленты</span>
            <span
              class="font-mono text-[10px] normal-case tracking-normal"
              :class="captionCharsLeft < 0 ? 'text-rose-300' : 'text-white/40'"
            >
              {{ captionCharsLeft }}
            </span>
          </span>
          <textarea
            v-model="caption"
            class="textarea h-20 w-full resize-none rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/35 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
            :maxlength="CAPTION_MAX"
            placeholder="Несколько слов о месте — необязательно"
            title="Подпись появится под фото в ленте"
          />
        </label>

        <div v-if="publishError" class="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-100">
          {{ publishError }}
        </div>

        <div v-if="publishedPostId" class="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Фото опубликовано в ленте и появится на live-глобусе.
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <button
            class="btn h-11 border-none bg-brand-gold text-brand-dark hover:bg-amber-100"
            type="button"
            :disabled="!canPublishSavedPhoto"
            title="Сделать фото публичным — оно попадёт в ленту и на live-глобус"
            @click="publishSavedPhotoToFeed"
          >
            <span v-if="publishLoading" class="loading loading-spinner loading-sm" />
            <Icon
              v-else
              name="tabler:world-upload"
              size="18"
            />
            В ленту
          </button>

          <NuxtLink
            v-if="publishedPostId"
            class="btn h-11 border-white/20 bg-white/8 text-white hover:border-white/35 hover:bg-white/15"
            to="/feed?tab=globe"
            title="Открыть live-глобус — увидите новую точку"
          >
            <Icon name="tabler:world" size="18" />
            Глобус
          </NuxtLink>

          <button
            v-else
            class="btn h-11 border-white/20 bg-white/8 text-white hover:border-white/35 hover:bg-white/15"
            type="button"
            title="Оставить фото приватным в дневнике"
            @click="openSavedDiary"
          >
            <Icon name="tabler:notebook" size="18" />
            В дневник
          </button>
        </div>

        <button
          class="btn mt-2 h-11 w-full border border-brand-emerald/55 bg-brand-emerald/15 text-brand-emerald hover:border-brand-emerald hover:bg-brand-emerald/25 hover:text-white"
          type="button"
          title="Сразу загрузить ещё одно место"
          @click="startAnotherCapture"
        >
          <Icon name="tabler:camera-plus" size="18" />
          Загрузить ещё
        </button>
      </div>
    </div>
  </section>
</template>
