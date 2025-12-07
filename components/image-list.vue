<script lang="ts" setup>
import VueEasyLightbox from "vue-easy-lightbox";

import type { SelectLocationLog } from "~/lib/db/schema";

const { locationLog, loading } = defineProps<{
  locationLog: SelectLocationLog;
  loading: boolean;
}>();
const config = useRuntimeConfig();

const visibleRef = ref(false);
const indexRef = ref(0);
const imgs = computed(() => locationLog.images.map(image => `${config.public.s3BucketUrl}/${image.key}`));

function openLightbox(index: number) {
  visibleRef.value = true;
  indexRef.value = index;
}

function onHide() {
  visibleRef.value = false;
}
</script>

<template>
  <div v-if="locationLog && !loading" class="flex flex-wrap gap-2 h-fit">
    <div
      v-for="(image, index) in locationLog.images"
      :key="image.id"
      class="p-2 bg-base-100 rounded-md card card-compact gap-2 w-[400px] h-[250px]"
    >
      <slot :image="image" />
      <img
        class="w-full h-full object-contain"
        :src="`${config.public.s3BucketUrl}/${image.key}`"
        alt="Изображение"
        @click="openLightbox(index)"
      >
    </div>
    <VueEasyLightbox
      :visible="visibleRef"
      :imgs="imgs"
      :index="indexRef"
      @hide="onHide"
    />
  </div>
</template>
