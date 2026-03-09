<script lang="ts" setup>
</script>

<template>
  <div class="absolute top-0 inset-x-0 z-30 px-6 py-4 flex justify-between items-center">
    <!-- Left: Logo -->
    <NuxtLink to="/" class="font-headline text-white text-xl tracking-tighter uppercase">
      WANDERLOG
    </NuxtLink>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <button class="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <Icon name="tabler:search" size="18" class="text-white" />
      </button>
      <AuthButton />
    </div>
  </div>
</template>
