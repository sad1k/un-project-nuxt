<script lang="ts" setup>
import type { RouteExportProvider } from "~/lib/explore/route-export";
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { buildRouteExportLink } from "~/lib/explore/route-export";

// Floating control that opens the current route in an external navigation app.
// Shows only when there's a real route (>= 2 stops). Deep links are built from
// the route's coordinates and opened in a new tab on user click.
const props = defineProps<{
  routePoints: RouteMapPoint[];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const visible = computed(() => props.routePoints.length >= 2);

const providers: Array<{ id: RouteExportProvider; label: string; icon: string }> = [
  { id: "google", label: "Google Карты", icon: "tabler:brand-google-maps" },
  { id: "yandex", label: "Яндекс Карты", icon: "tabler:map-2" },
];

function linkFor(id: RouteExportProvider) {
  return buildRouteExportLink(id, props.routePoints);
}

function openProvider(id: RouteExportProvider) {
  const link = linkFor(id);
  if (!link)
    return;
  window.open(link.url, "_blank", "noopener,noreferrer");
  open.value = false;
}

function onDocClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node))
    open.value = false;
}
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape")
    open.value = false;
}

onMounted(() => {
  if (typeof window === "undefined")
    return;
  window.addEventListener("click", onDocClick);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  if (typeof window === "undefined")
    return;
  window.removeEventListener("click", onDocClick);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div
    v-if="visible"
    ref="root"
    class="pointer-events-auto relative"
  >
    <button
      type="button"
      class="explore-control inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-lg backdrop-blur-xl transition-all hover:text-brand-gold"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-label="Открыть маршрут во внешних картах"
      @click="open = !open"
    >
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--explore-surface-soft)] text-[var(--explore-accent-strong)]">
        <Icon name="tabler:external-link" size="14" />
      </span>
      <span class="flex flex-col items-start leading-tight">
        <span class="text-xs font-bold text-[var(--explore-text)]">Открыть в картах</span>
        <span class="font-mono text-[10px] text-[var(--explore-text-soft)]">Google · Яндекс</span>
      </span>
    </button>

    <Transition name="route-export-pop">
      <div
        v-if="open"
        role="menu"
        class="explore-panel absolute bottom-[calc(100%+8px)] left-0 z-50 w-56 overflow-hidden rounded-xl border p-1 shadow-xl"
      >
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--explore-surface-hover)]"
          :aria-label="`Открыть маршрут в ${provider.label}`"
          @click="openProvider(provider.id)"
        >
          <Icon
            :name="provider.icon"
            size="18"
            class="shrink-0 text-[var(--explore-accent-strong)]"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-bold text-[var(--explore-text)]">{{ provider.label }}</span>
            <span
              v-if="linkFor(provider.id)?.droppedCount"
              class="block font-mono text-[10px] text-[var(--explore-text-soft)]"
            >
              первые {{ linkFor(provider.id)?.stopCount }} точек
            </span>
          </span>
          <Icon
            name="tabler:external-link"
            size="13"
            class="shrink-0 text-[var(--explore-text-faint)]"
          />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.route-export-pop-enter-active,
.route-export-pop-leave-active {
  transition:
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.route-export-pop-enter-from,
.route-export-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
