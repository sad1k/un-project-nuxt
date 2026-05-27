<script lang="ts" setup>
const route = useRoute();

const isHome = computed(() => route.path === "/");
const isPlacePhotoCapture = computed(() => route.path.startsWith("/dashboard/place-photo"));
const showSideRail = computed(() => !isHome.value);
const showNavBar = computed(() => !isHome.value);
const showMobileToolbar = computed(() => !isHome.value);
const showMobileMap = computed(() =>
  (route.path === "/dashboard" || route.path.startsWith("/dashboard/")) && !isPlacePhotoCapture.value,
);
</script>

<template>
  <div class="app-shell min-h-screen">
    <ClientOnly>
      <OfflineOfflineBanner />
    </ClientOnly>
    <AppNavBar v-if="showNavBar" />
    <div class="flex min-h-screen md:pb-0" :class="{ 'pt-16': showNavBar, 'pb-20': showMobileToolbar }">
      <AppSideRail v-if="showSideRail" />
      <main class="flex min-w-0 flex-1 flex-col">
        <slot />
      </main>
    </div>
    <AppMobileToolbar v-if="showMobileToolbar" />
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
      <OfflineIosA2hsBanner />
    </ClientOnly>
  </div>
</template>
