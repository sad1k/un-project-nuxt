<script lang="ts" setup>
</script>

<template>
  <div class="absolute top-0 inset-x-0 z-30 px-6 py-4 flex justify-between items-center">
    <!-- Left: Logo -->
    <div class="flex items-center gap-3">
      <NuxtLink to="/" class="font-headline text-white text-xl tracking-tighter uppercase">
        WANDERLOG
      </NuxtLink>
    </div>

    <!-- Center: Nav links -->
    <div class="flex items-center gap-6">
      <NuxtLink to="/explore" class="text-brand-gold border-b-2 border-brand-gold pb-1 text-sm font-semibold">Explore</NuxtLink>
      <NuxtLink to="/" class="text-white/50 hover:text-white/80 text-sm font-medium transition-colors">Feed</NuxtLink>
      <NuxtLink to="/dashboard" class="text-white/50 hover:text-white/80 text-sm font-medium transition-colors">My Places</NuxtLink>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <button class="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <Icon name="tabler:search" size="18" class="text-white" />
      </button>
      <AuthButton />
    </div>
  </div>
</template>
