<script lang="ts" setup>
import type { SelectLocationLog, SelectLocationLogImage } from "~/lib/db/schema";

const props = defineProps<{
  image: SelectLocationLogImage;
  locationLog: SelectLocationLog;
}>();

const emit = defineEmits<{
  (event: "updated"): void;
}>();

const route = useRoute();
const { $csrfFetch } = useNuxtApp();

const loading = ref(false);
const errorMessage = ref("");
const publicPlaceName = ref(props.image.publicPlaceName ?? props.locationLog.name);
const publicLat = ref(props.image.publicLat ?? props.locationLog.lat);
const publicLong = ref(props.image.publicLong ?? props.locationLog.long);

const isPublic = computed(() => props.image.visibility === "public");

async function makePublic() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}/images/${props.image.id}/visibility`, {
      method: "PATCH",
      body: {
        visibility: "public",
        publicPlaceName: publicPlaceName.value,
        publicLat: publicLat.value,
        publicLong: publicLong.value,
        locationSource: props.image.locationSource ?? "manual",
        locationAccuracy: props.image.locationAccuracy,
      },
    });
    emit("updated");
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось опубликовать фото";
  }
  finally {
    loading.value = false;
  }
}

async function makePrivate() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}/images/${props.image.id}/visibility`, {
      method: "PATCH",
      body: {
        visibility: "private",
      },
    });
    emit("updated");
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось сделать фото личным";
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/80 p-3 text-sm text-gray-950 dark:border-white/10 dark:bg-black/20 dark:text-white">
    <div class="flex items-center justify-between gap-3">
      <span class="font-medium">
        {{ isPublic ? "Публично на карте" : "Личное фото дневника" }}
      </span>
      <button
        v-if="isPublic"
        class="btn btn-xs border-gray-300 bg-transparent text-gray-800 hover:bg-gray-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
        type="button"
        :disabled="loading"
        @click="makePrivate"
      >
        <Icon name="tabler:lock" size="14" />
        Сделать личным
      </button>
    </div>

    <template v-if="!isPublic">
      <label class="form-control">
        <span class="label-text text-gray-600 dark:text-white/60">Публичное название места</span>
        <input v-model="publicPlaceName" class="input input-xs input-bordered border-gray-200 bg-white text-gray-950 dark:border-white/10 dark:bg-black/30 dark:text-white">
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="form-control">
          <span class="label-text text-gray-600 dark:text-white/60">Широта</span>
          <input
            v-model.number="publicLat"
            class="input input-xs input-bordered border-gray-200 bg-white text-gray-950 dark:border-white/10 dark:bg-black/30 dark:text-white"
            type="number"
            step="0.00001"
          >
        </label>
        <label class="form-control">
          <span class="label-text text-gray-600 dark:text-white/60">Долгота</span>
          <input
            v-model.number="publicLong"
            class="input input-xs input-bordered border-gray-200 bg-white text-gray-950 dark:border-white/10 dark:bg-black/30 dark:text-white"
            type="number"
            step="0.00001"
          >
        </label>
      </div>
      <button
        class="btn btn-xs border-none bg-brand-sangria text-white hover:bg-rose-600"
        type="button"
        :disabled="loading || !publicPlaceName"
        @click="makePublic"
      >
        <span v-if="loading" class="loading loading-spinner loading-xs" />
        <Icon
          v-else
          name="tabler:world-upload"
          size="14"
        />
        Опубликовать
      </button>
    </template>

    <p v-if="errorMessage" class="text-xs text-error">
      {{ errorMessage }}
    </p>
  </div>
</template>
