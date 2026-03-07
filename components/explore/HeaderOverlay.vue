<script lang="ts" setup>
</script>

<template>
  <div class="absolute top-0 inset-x-0 z-30 px-6 py-4 flex justify-between items-center">
    <!-- Left: Logo -->
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
        <Icon name="tabler:compass" size="22" class="text-white" />
      </div>
      <span class="font-headline text-white text-xl font-bold">Wanderlust</span>
    </div>

    <!-- Center: Nav links -->
    <div class="flex items-center gap-6">
      <a href="#" class="text-white border-b-2 border-amber-400 pb-1 text-sm font-medium">Explore</a>
      <a href="#" class="text-white/60 hover:text-white/80 text-sm font-medium transition-colors">My Trips</a>
      <a href="#" class="text-white/60 hover:text-white/80 text-sm font-medium transition-colors">Saved</a>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <button class="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <Icon name="tabler:search" size="18" class="text-white" />
      </button>
      <div class="w-10 h-10 bg-gray-400 rounded-full" />
    </div>
  </div>
</template>
