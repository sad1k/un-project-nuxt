<script lang="ts" setup>
const authStore = useAuthStore();

await authStore.init();
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <AppNavBar />
    <main class="flex-1 flex flex-col">
      <slot />
    </main>
  </div>
</template>
