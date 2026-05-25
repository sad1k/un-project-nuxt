<script lang="ts" setup>
const locationStore = useLocationStore();
const { currentLocationLog } = storeToRefs(locationStore);
const imageFile = ref<File | null>(null);
const imageUrl = ref<string | null>(null);
const inputRef = useTemplateRef<HTMLInputElement>("inputRef");
const loading = ref(false);

const route = useRoute();

const notifications = ref<Array<{ id: string; description: string }>>([]);

const pending = usePendingOperationsStore();
const pendingPhotoUploads = computed(() =>
  pending.operations.filter(op =>
    op.type === "photo.upload" && op.payload.logId === Number(route.params.id),
  ),
);

function onFileChange(file: File) {
  if (file) {
    imageFile.value = file;
    imageUrl.value = URL.createObjectURL(file);
  }
}

async function resizeToBlob(source: File, url: string): Promise<Blob> {
  const newImage = new Image();
  newImage.src = url;
  await new Promise<void>((resolve, reject) => {
    newImage.onload = () => resolve();
    newImage.onerror = () => reject(new Error("Не удалось прочитать изображение"));
  });
  const width = Math.min(newImage.width, 1000);
  const resized = await createImageBitmap(newImage, { resizeWidth: width });
  const canvas = new OffscreenCanvas(width, resized.height);
  canvas.getContext("bitmaprenderer")?.transferFromImageBitmap(resized);
  return canvas.convertToBlob({ type: "image/png", quality: 0.9 });
}

async function uploadImage() {
  if (!imageFile.value || !imageUrl.value || !currentLocationLog.value)
    return;

  loading.value = true;
  try {
    const blob = await resizeToBlob(imageFile.value, imageUrl.value);
    const queue = useOfflineQueue();
    const pending = usePendingOperationsStore();
    await queue.enqueuePhoto(blob, {
      locationSlug: route.params.slug as string,
      logId: Number(route.params.id),
    });
    await pending.refresh();
  }
  catch (error) {
    const id = `err-${Date.now()}`;
    notifications.value.push({
      id,
      description: error instanceof Error ? error.message : "Неизвестная ошибка загрузки",
    });
    setTimeout(() => {
      notifications.value = notifications.value.filter(n => n.id !== id);
    }, 5000);
  }
  finally {
    loading.value = false;
    imageFile.value = null;
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = null;
    }
    if (inputRef.value)
      inputRef.value.value = "";
  }
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

    <div v-if="pendingPhotoUploads.length" class="mt-2">
      <h3 class="mb-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        Загружается ({{ pendingPhotoUploads.length }})
      </h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        <OfflineQueuedPhotoThumb
          v-for="op in pendingPhotoUploads"
          :key="op.opId"
          :op-id="op.opId"
          :status="op.status"
        />
      </div>
    </div>
  </div>
</template>
