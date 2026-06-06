<script lang="ts" setup>
import type { OfflineRegion } from "~/lib/offline/region-store";

// Prerendered, layout-free app shell that boots straight into the saved
// offline maps — no auth, no API calls, no network. The service worker serves
// this document for any navigation while offline (see public/wanderlog-sw.js),
// so the app "cold-starts" into the map even with no connection. All real UI is
// client-only because it reads from IndexedDB, which keeps the prerendered
// output a clean, dependency-free shell.
definePageMeta({ layout: false });

useHead({
  title: "Офлайн-карты — WanderLog",
  meta: [{ name: "robots", content: "noindex" }],
});

const previewRegion = ref<OfflineRegion | null>(null);

function onSelectRegion(region: OfflineRegion) {
  previewRegion.value = region;
}

function onClosePreview() {
  previewRegion.value = null;
}

async function onCloseManager() {
  // Return to the app. Online → home; offline → the service worker re-serves
  // this shell, so the user stays on the saved-maps screen.
  await navigateTo("/");
}
</script>

<template>
  <div class="offline-shell">
    <ClientOnly>
      <OfflineRegionsManager
        :open="true"
        @close="onCloseManager"
        @select="onSelectRegion"
      />
      <OfflineRegionPreview
        :region="previewRegion"
        @close="onClosePreview"
      />

      <template #fallback>
        <div class="offline-shell__loading">
          <p>Загрузка офлайн-карт…</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.offline-shell {
  min-height: 100dvh;
  background: #0b1120;
  color: #e2e8f0;
}

.offline-shell__loading {
  display: flex;
  min-height: 100dvh;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #94a3b8;
}
</style>
