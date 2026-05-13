<script lang="ts" setup>
const actions = [
  { icon: "tabler:history", label: "History" },
  { icon: "tabler:bookmark", label: "Saved" },
  { icon: "tabler:share", label: "Share" },
  { icon: "tabler:settings", label: "Settings" },
];
</script>

<template>
  <div class="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
    <button
      v-for="action in actions"
      :key="action.icon"
      :aria-label="action.label"
      class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/80 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
      type="button"
    >
      <Icon
        :name="action.icon"
        class="text-gray-600"
        size="20"
      />
    </button>
  </div>
</template>
