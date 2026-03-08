<script lang="ts" setup>
const actions = [
  { icon: 'tabler:history' },
  { icon: 'tabler:bookmark' },
  { icon: 'tabler:share' },
  { icon: 'tabler:settings' },
]
</script>

<template>
  <div class="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
    <button
      v-for="action in actions"
      :key="action.icon"
      class="w-11 h-11 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 flex items-center justify-center hover:bg-white hover:scale-105 hover:shadow-xl transition-all duration-200"
    >
      <Icon :name="action.icon" size="20" class="text-gray-600" />
    </button>
  </div>
</template>
