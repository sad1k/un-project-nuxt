<script lang="ts" setup>
const authStore = useAuthStore();
const route = useRoute();

const showSideRail = computed(() => route.path !== "/");
const showMobileMap = computed(() => route.path === "/dashboard" || route.path.startsWith("/dashboard/"));

await authStore.init();
</script>

<template>
  <div class="app-shell min-h-screen">
    <AppNavBar />
    <div class="flex min-h-screen pt-16 pb-20 md:pb-0">
      <AppSideRail v-if="showSideRail" />
      <main class="flex min-w-0 flex-1 flex-col">
        <slot />
      </main>
    </div>
    <AppMobileToolbar />
    <AppMapBottomSheet v-if="showMobileMap" />
    <div class="pwa-shell-stack pointer-events-none fixed inset-x-3 bottom-3 z-40 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
      <div class="pointer-events-auto">
        <AppPwaStatus />
      </div>
      <div class="pointer-events-auto">
        <AppPwaInstallPrompt />
      </div>
    </div>
    <ClientOnly>
      <AppRequestErrorNotifications />
    </ClientOnly>
  </div>
</template>
