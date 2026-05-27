<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

import { type Bbox, bboxAreaKm2, bboxCovers, bboxFromRoute } from "~/lib/offline/bbox-from-route";
import { estimateRegionSize, formatSizeMB } from "~/lib/offline/size-estimator";

// Floating trigger that announces an offline-download option for the
// currently visible route. Computes a padded bbox from the points and
// shows the user how big the archive will be. If the bbox is already
// contained inside a saved region, the trigger morphs into a "Доступно
// офлайн" shortcut that opens the regions manager instead.

const props = defineProps<{
  routePoints: RouteMapPoint[];
}>();

const emit = defineEmits<{
  request: [payload: { bbox: Bbox; estimatedBytes: number; pointCount: number }];
  openManager: [];
}>();

const { isOnline } = useOnline();
const offlineRegions = useOfflineRegions();

const bbox = computed(() => bboxFromRoute(props.routePoints));
const sizeEstimate = computed(() => bbox.value ? estimateRegionSize(bbox.value) : null);
const sizeLabel = computed(() => sizeEstimate.value ? formatSizeMB(sizeEstimate.value.bytes) : "");
const areaKm2 = computed(() => bbox.value ? bboxAreaKm2(bbox.value) : 0);
const areaLabel = computed(() => {
  if (areaKm2.value < 1)
    return "< 1 км²";
  if (areaKm2.value >= 1000)
    return `${Math.round(areaKm2.value / 100) * 100} км²`;
  return `${Math.round(areaKm2.value)} км²`;
});

const coveringRegion = computed(() => {
  const currentBbox = bbox.value;
  if (!currentBbox || !offlineRegions.isLoaded.value)
    return null;
  return offlineRegions.regions.value.find(region => bboxCovers(region.bbox, currentBbox)) ?? null;
});

const isCovered = computed(() => coveringRegion.value !== null);

// Show only when there's a real route AND we're online. Offline users
// either already downloaded the region or can't download a new one
// regardless — either way the trigger is irrelevant in that state.
const visible = computed(() => Boolean(props.routePoints.length) && isOnline.value);

const iconName = computed(() => isCovered.value ? "tabler:cloud-check" : "tabler:download");
const iconWrapperClass = computed(() =>
  isCovered.value
    ? "bg-[var(--explore-success-bg)] text-[var(--explore-success-text)]"
    : "bg-[var(--explore-surface-soft)] text-[var(--explore-accent-strong)]",
);
const primaryLabel = computed(() => isCovered.value ? "Доступно офлайн" : "Скачать офлайн");
const secondaryLabel = computed(() =>
  isCovered.value
    ? "регион сохранён · открыть менеджер"
    : `~${sizeLabel.value} · ${props.routePoints.length} точек`,
);
const ariaLabel = computed(() =>
  isCovered.value
    ? `Регион доступен офлайн (${coveringRegion.value?.regionLabel ?? "без названия"}), открыть менеджер`
    : `Скачать карту для офлайн-доступа, примерно ${sizeLabel.value}`,
);
const titleText = computed(() =>
  isCovered.value
    ? `Покрыт регионом «${coveringRegion.value?.regionLabel ?? "без названия"}»`
    : `Точек: ${props.routePoints.length} · площадь ${areaLabel.value}`,
);

function onClick() {
  if (isCovered.value) {
    emit("openManager");
    return;
  }

  if (!bbox.value || !sizeEstimate.value)
    return;

  emit("request", {
    bbox: bbox.value,
    estimatedBytes: sizeEstimate.value.bytes,
    pointCount: props.routePoints.length,
  });
}
</script>

<template>
  <Transition name="offline-trigger">
    <button
      v-if="visible"
      type="button"
      class="explore-control pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-lg backdrop-blur-xl transition-all hover:text-brand-gold"
      :aria-label="ariaLabel"
      :title="titleText"
      @click="onClick"
    >
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
        :class="iconWrapperClass"
      >
        <Icon :name="iconName" size="14" />
      </span>
      <span class="flex flex-col items-start leading-tight">
        <span class="text-xs font-bold text-[var(--explore-text)]">{{ primaryLabel }}</span>
        <span class="font-mono text-[10px] text-[var(--explore-text-soft)]">{{ secondaryLabel }}</span>
      </span>
    </button>
  </Transition>
</template>

<style scoped>
.offline-trigger-enter-active,
.offline-trigger-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-trigger-enter-from,
.offline-trigger-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
