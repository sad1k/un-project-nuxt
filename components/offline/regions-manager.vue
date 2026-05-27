<script lang="ts" setup>
import { toast } from "vue-sonner";

import type { OfflineRegion } from "~/lib/offline/region-store";

import { bboxAreaKm2 } from "~/lib/offline/bbox-from-route";
import { formatSizeMB } from "~/lib/offline/size-estimator";

// Lists all saved offline regions. Each entry has a Mapbox-static
// preview, size/area/age, a status badge and a delete button with an
// undo toast. Region tap emits `select` for the parent to fly the map
// to its bbox.

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [region: OfflineRegion];
}>();

const STORAGE_LIMIT_BYTES = 200 * 1024 * 1024;
const QUOTA_WARNING_THRESHOLD = 80;
const UNDO_TOAST_MS = 5000;

const config = useRuntimeConfig();
const colorMode = useColorMode();
const offlineRegions = useOfflineRegions();

const totalUsedBytes = computed(() =>
  offlineRegions.regions.value.reduce((sum, region) => sum + region.estimatedBytes, 0),
);

const quotaPercent = computed(() =>
  Math.min(100, Math.round((totalUsedBytes.value / STORAGE_LIMIT_BYTES) * 100)),
);

const quotaIsHigh = computed(() => quotaPercent.value >= QUOTA_WARNING_THRESHOLD);

function previewUrl(region: OfflineRegion): string | null {
  const token = config.public.mapboxToken;
  if (!token)
    return null;
  const [w, s, e, n] = region.bbox;
  const styleId = colorMode.value === "light" ? "outdoors-v12" : "dark-v11";
  const bboxParam = `%5B${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}%5D`;
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${bboxParam}/240x140@2x?access_token=${token}`;
}

function regionDisplayName(region: OfflineRegion): string {
  if (region.regionLabel)
    return region.regionLabel;
  const date = new Date(region.dateAdded);
  return `Регион от ${date.toLocaleDateString("ru-RU")}`;
}

function formatRelativeRu(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)
    return "только что";
  if (diffMin < 60)
    return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24)
    return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1)
    return "вчера";
  if (diffDays < 7)
    return `${diffDays} дн назад`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} нед назад`;
  return `${Math.floor(diffDays / 30)} мес назад`;
}

function areaLabel(region: OfflineRegion): string {
  const area = bboxAreaKm2(region.bbox);
  if (area < 1)
    return "< 1 км²";
  if (area >= 1000)
    return `${Math.round(area / 100) * 100} км²`;
  return `${Math.round(area)} км²`;
}

type StatusTone = "warning" | "success" | "info" | "danger";

function statusBadge(region: OfflineRegion): { label: string; tone: StatusTone } {
  switch (region.status) {
    case "complete":
      return { label: "Доступно офлайн", tone: "success" };
    case "downloading":
      return { label: "Скачивание…", tone: "info" };
    case "error":
      return { label: "Ошибка", tone: "danger" };
    default:
      return { label: "Метаданные", tone: "warning" };
  }
}

async function onDelete(region: OfflineRegion) {
  await offlineRegions.remove(region.id);
  toast("Регион удалён", {
    description: regionDisplayName(region),
    action: {
      label: "Отменить",
      onClick: async () => {
        // Recreate the metadata entry. The id/timestamps change but the
        // user's intent (keep this region) is preserved.
        await offlineRegions.add({
          bbox: region.bbox,
          estimatedBytes: region.estimatedBytes,
          pointCount: region.pointCount,
          regionLabel: region.regionLabel,
          status: region.status,
        });
      },
    },
    duration: UNDO_TOAST_MS,
  });
}

async function onSelect(region: OfflineRegion) {
  await offlineRegions.touch(region.id);
  emit("select", region);
}

function onClose() {
  emit("close");
}

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && props.open)
    onClose();
}

onMounted(() => {
  if (typeof window === "undefined")
    return;
  window.addEventListener("keydown", onEscape);
});

onBeforeUnmount(() => {
  if (typeof window === "undefined")
    return;
  window.removeEventListener("keydown", onEscape);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="offline-manager">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex max-md:items-end md:items-stretch md:justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-manager-title"
      >
        <!-- Backdrop -->
        <button
          type="button"
          aria-label="Закрыть"
          class="absolute inset-0 bg-black/55 backdrop-blur-sm"
          @click="onClose"
        />

        <!-- Panel -->
        <section
          class="offline-manager-panel explore-panel relative flex w-full flex-col overflow-hidden border max-md:max-h-[88dvh] max-md:rounded-t-2xl md:max-w-[520px] md:rounded-l-2xl"
        >
          <!-- Header -->
          <header class="shrink-0 border-b border-[var(--explore-border)] px-5 py-4">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--explore-accent-strong)]">
                  Офлайн
                </p>
                <h2
                  id="offline-manager-title"
                  class="mt-1 truncate text-base font-bold text-[var(--explore-text)]"
                >
                  Офлайн-карты
                </h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть"
                class="explore-icon-button flex h-9 w-9 items-center justify-center rounded-xl border"
                @click="onClose"
              >
                <Icon name="tabler:x" size="16" />
              </button>
            </div>

            <!-- Quota bar -->
            <div class="mt-3">
              <div class="mb-1.5 flex items-baseline justify-between gap-2">
                <span class="text-xs text-[var(--explore-text-muted)]">
                  Использовано {{ formatSizeMB(totalUsedBytes) }} из ~200 МБ
                </span>
                <span
                  class="font-mono text-[10px]"
                  :class="quotaIsHigh ? 'text-[var(--explore-warning-text)]' : 'text-[var(--explore-text-faint)]'"
                >
                  {{ quotaPercent }}%
                </span>
              </div>
              <div class="explore-progress-track h-1.5 overflow-hidden rounded-full">
                <div
                  class="h-full rounded-full transition-all"
                  :class="quotaIsHigh ? 'bg-[var(--explore-warning-text)]' : 'bg-[var(--explore-primary-bg)]'"
                  :style="{ width: `${quotaPercent}%` }"
                />
              </div>
            </div>
          </header>

          <!-- Body -->
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <!-- Empty state -->
            <div
              v-if="!offlineRegions.regions.value.length"
              class="flex flex-col items-center gap-3 py-12 text-center"
            >
              <div class="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--explore-surface-soft)] text-[var(--explore-text-faint)]">
                <Icon name="tabler:cloud-download" size="28" />
              </div>
              <h3 class="text-sm font-bold text-[var(--explore-text)]">
                Нет сохранённых регионов
              </h3>
              <p class="max-w-xs text-xs leading-5 text-[var(--explore-text-muted)]">
                Создайте маршрут и нажмите «Скачать офлайн», чтобы сохранить регион для доступа без сети.
              </p>
            </div>

            <!-- Region list -->
            <ul v-else class="space-y-2.5">
              <li
                v-for="region in offlineRegions.regions.value"
                :key="region.id"
                class="explore-card overflow-hidden rounded-xl border"
              >
                <div class="flex items-stretch gap-3 p-2.5">
                  <!-- Thumb -->
                  <button
                    type="button"
                    class="relative h-[72px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-[var(--explore-surface-hover)] transition hover:opacity-90"
                    :aria-label="`Открыть ${regionDisplayName(region)}`"
                    @click="onSelect(region)"
                  >
                    <img
                      v-if="previewUrl(region)"
                      :src="previewUrl(region) ?? ''"
                      :alt="regionDisplayName(region)"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    >
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center text-[var(--explore-text-faint)]"
                    >
                      <Icon name="tabler:map" size="24" />
                    </div>
                  </button>

                  <!-- Meta + actions -->
                  <div class="flex min-w-0 flex-1 flex-col justify-between gap-1">
                    <div class="min-w-0">
                      <button
                        type="button"
                        class="block w-full truncate text-left text-sm font-bold text-[var(--explore-text)] transition hover:text-brand-gold"
                        @click="onSelect(region)"
                      >
                        {{ regionDisplayName(region) }}
                      </button>
                      <p class="mt-0.5 font-mono text-[11px] text-[var(--explore-text-soft)]">
                        ≈ {{ formatSizeMB(region.estimatedBytes) }} · {{ areaLabel(region) }} · {{ region.pointCount }} точек
                      </p>
                      <p class="mt-0.5 text-[11px] text-[var(--explore-text-faint)]">
                        Сохранено {{ formatRelativeRu(region.dateAdded) }}
                      </p>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                      <span
                        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
                        :class="{
                          'explore-status-success': statusBadge(region).tone === 'success',
                          'explore-status-warning': statusBadge(region).tone === 'warning',
                          'explore-status-info': statusBadge(region).tone === 'info',
                          'explore-status-danger': statusBadge(region).tone === 'danger',
                        }"
                      >
                        {{ statusBadge(region).label }}
                      </span>
                      <button
                        type="button"
                        :aria-label="`Удалить ${regionDisplayName(region)}`"
                        class="explore-icon-button flex h-8 w-8 items-center justify-center rounded-lg border transition hover:text-[var(--explore-danger-text)]"
                        @click="onDelete(region)"
                      >
                        <Icon name="tabler:trash" size="14" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.offline-manager-panel {
  box-shadow: 0 -16px 60px var(--explore-overlay-shadow);
}

.offline-manager-enter-active,
.offline-manager-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-manager-enter-active .offline-manager-panel,
.offline-manager-leave-active .offline-manager-panel {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-manager-enter-from,
.offline-manager-leave-to {
  opacity: 0;
}

.offline-manager-enter-from .offline-manager-panel,
.offline-manager-leave-to .offline-manager-panel {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .offline-manager-enter-from .offline-manager-panel,
  .offline-manager-leave-to .offline-manager-panel {
    transform: translateY(0) translateX(100%);
  }
}
</style>
