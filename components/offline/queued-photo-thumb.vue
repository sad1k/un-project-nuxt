<script setup lang="ts">
import { getPhotoBlob } from "~/lib/offline/idb";
import type { PendingStatus } from "~/lib/offline/operation-types";

const props = defineProps<{
  opId: string;
  status: PendingStatus;
  alt?: string;
}>();

const url = ref<string | null>(null);

onMounted(async () => {
  if (!import.meta.client)
    return;
  const blob = await getPhotoBlob(props.opId);
  if (blob)
    url.value = URL.createObjectURL(blob);
});

onBeforeUnmount(() => {
  if (url.value)
    URL.revokeObjectURL(url.value);
});
</script>

<template>
  <div class="relative aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
    <img
      v-if="url"
      :src="url"
      :alt="alt || 'Pending upload'"
      class="size-full object-cover"
    >
    <div v-else class="size-full animate-pulse bg-gray-200 dark:bg-gray-700" />
    <div class="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5">
      <OfflinePendingBadge :status="status" />
    </div>
  </div>
</template>
