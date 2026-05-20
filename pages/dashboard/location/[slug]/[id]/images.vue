<script lang="ts" setup>
import type { FetchError } from "ofetch";

const locationStore = useLocationStore();
const { currentLocationLog } = storeToRefs(locationStore);
const imageFile = ref<File | null>(null);
const imageUrl = ref<string | null>(null);
const inputRef = useTemplateRef<HTMLInputElement>("inputRef");
const loading = ref(false);

const { $csrfFetch } = useNuxtApp();
const route = useRoute();

const notifications = ref([

]);

function onFileChange(file: File) {
  console.log(file, "file");
  if (file) {
    imageFile.value = file;
    imageUrl.value = URL.createObjectURL(file);
  }
}

async function getChecksum(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function uploadImage() {
  if (!imageFile.value || !imageUrl.value)
    return;

  loading.value = true;
  const newImage = new Image();
  newImage.src = imageUrl.value;
  const width = Math.min(newImage.width, 1000);
  newImage.onload = async () => {
    const resized = await createImageBitmap(newImage, {
      resizeWidth: width,
    });

    const canvas = new OffscreenCanvas(width, resized.height);
    canvas.getContext("bitmaprenderer")?.transferFromImageBitmap(resized);

    const blob = await canvas.convertToBlob({
      type: "image/png",
      quality: 0.9,
    });

    const checkSum = await getChecksum(blob);
    try {
      const { url, fields, key } = await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}/sign-images`, {
        method: "POST",
        body: {
          checksum: checkSum,
          contentLength: blob.size,
        },
      });

      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      formData.append("file", blob);
      await $fetch(url, {
        method: "POST",
        body: formData,
      });

      const insertedImage = await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}/image`, {
        method: "POST",
        body: {
          key,
        },
      });

      console.log(insertedImage);
    }
    catch (error) {
      const errorMessage = error as unknown as FetchError;
      notifications.value.push({
        id: "123",
        name: "Ошибка загрузки изображения",
        description: errorMessage.data?.statusMessage || errorMessage.statusMessage || "Неизвестная ошибка",
        time: "Now",
        color: "",
      });
      setTimeout(() => {
        notifications.value.shift();
      }, 5000);
    }
    finally {
      loading.value = false;
      imageFile.value = null;
      imageUrl.value = null;
      if (inputRef.value) {
        inputRef.value.value = "";
      }
    }
  };
}
</script>

<template>
  <div class="page-content-top h-[600px] flex flex-col gap-4">
    <div class="toast z-[9999]">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="alert alert-error"
      >
        <span>{{ notification.description }}</span>
      </div>
    </div>
    <h2 class="font-bold mb-4">
      Управление изображениями для {{ currentLocationLog?.name || "Загрузка..." }}
    </h2>
    <div class="flex gap-4">
      <div v-if="currentLocationLog && !loading">
        <div class="w-[250px] h-[160px]">
          <div class="flex flex-col gap-2 h-full">
            <div class="hidden">
              <p v-if="!imageUrl" class="text-center">
                Выберите изображение для загрузки
              </p>
              <img
                v-else-if="imageUrl"
                :src="imageUrl"
                class="w-full h-full object-contain"
                alt="Изображение"
              >
              <span
                v-if="loading"
                class=" size-10 mx-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 loading loading-spinner loading-lg"
              />
            </div>
            <ClientOnly>
              <FileUpload @on-change="onFileChange">
                <FileUploadGrid />
              </FileUpload>
            </ClientOnly>

            <button
              v-if="imageFile"
              class="btn btn-primary"
              :disabled="loading"
              @click="uploadImage"
            >
              Загрузить
              изображение
            </button>
          </div>
        </div>
      </div>

      <ImageList
        v-if="currentLocationLog && !loading"
        :location-log="currentLocationLog"
        :loading="loading"
      />
    </div>
  </div>
</template>
