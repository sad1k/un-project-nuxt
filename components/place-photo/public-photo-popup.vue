<script lang="ts" setup>
defineProps<{
  photo: {
    imageUrl: string;
    publicPlaceName: string;
    authorName: string;
    publishedAt: number;
  };
}>();
</script>

<template>
  <article class="w-64 overflow-hidden rounded-lg bg-[#050505] text-white">
    <img
      :src="photo.imageUrl"
      :alt="photo.publicPlaceName"
      class="h-36 w-full object-cover"
    >
    <div class="space-y-1 p-3">
      <p class="text-sm font-semibold">
        {{ photo.publicPlaceName }}
      </p>
      <p class="text-xs text-white/65">
        {{ photo.authorName }}
      </p>
      <p class="text-xs text-white/45">
        {{ new Date(photo.publishedAt).toLocaleDateString() }}
      </p>
    </div>
  </article>
</template>
