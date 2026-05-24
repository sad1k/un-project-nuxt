<script lang="ts" setup>
const { liked, count, disabled } = defineProps<{
  liked: boolean;
  count: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const isAnimating = ref(false);

function handleClick() {
  if (disabled)
    return;
  isAnimating.value = true;
  emit("toggle");
  setTimeout(() => {
    isAnimating.value = false;
  }, 300);
}
</script>

<template>
  <button
    class="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
    :class="[
      liked
        ? 'text-rose-500 hover:bg-rose-500/10'
        : 'text-gray-500 hover:text-rose-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    :disabled="disabled"
    @click="handleClick"
  >
    <Icon
      :name="liked ? 'tabler:heart-filled' : 'tabler:heart'"
      size="24"
      class="transition-transform duration-200"
      :class="{ 'scale-125': isAnimating }"
    />
    <span class="font-medium text-sm">{{ count }}</span>
  </button>
</template>
