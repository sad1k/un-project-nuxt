<script setup lang="ts">
useHead({
  link: [
    { href: "/manifest.webmanifest", rel: "manifest" },
    { href: "/icons/wanderlog-icon-192.png", rel: "icon", sizes: "192x192", type: "image/png" },
    { href: "/icons/wanderlog-apple-touch.png", rel: "apple-touch-icon", sizes: "180x180" },
  ],
  meta: [
    { content: "#0F766E", name: "theme-color" },
    { content: "yes", name: "apple-mobile-web-app-capable" },
    { content: "WanderLog", name: "apple-mobile-web-app-title" },
    { content: "default", name: "apple-mobile-web-app-status-bar-style" },
  ],
});

const pendingOperations = usePendingOperationsStore();
onMounted(() => {
  void pendingOperations.init();
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage :transition="{ name: 'route-fade', mode: 'out-in' }" />
  </NuxtLayout>
</template>
