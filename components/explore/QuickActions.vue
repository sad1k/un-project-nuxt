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
      class="w-11 h-11 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/15 hover:scale-105 hover:border-white/20 transition-all duration-200"
    >
      <Icon :name="action.icon" size="20" class="text-white/70" />
    </button>
  </div>
</template>
