<script lang="ts" setup>
import { toast } from "vue-sonner";

import { type Bbox, bboxAreaKm2 } from "~/lib/offline/bbox-from-route";
import { formatSizeMB } from "~/lib/offline/size-estimator";
import { countTiles } from "~/lib/offline/tile-enumerator";

// Modal sheet shown when the user taps the offline-download trigger.
// On confirm we persist region metadata to IndexedDB, then kick off the
// real PMTiles fetcher. Progress comes back through `useOfflineRegions`
// (reactive), so the footer button reflects tilesDone / totalTiles as
// the bytes stream in.

type SaveState = "idle" | "saving" | "downloading" | "complete" | "error";

const props = defineProps<{
  payload: {
    bbox: Bbox;
    estimatedBytes: number;
    pointCount: number;
  } | null;
  /** Optional human-readable label, e.g. the trip's selected city. */
  regionLabel?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [payload: { bbox: Bbox; estimatedBytes: number; pointCount: number }];
}>();

const STORAGE_LIMIT_BYTES = 200 * 1024 * 1024; // ~200 MB soft cap
const KM_PER_DEGREE_LAT = 111;
const SAVED_CLOSE_DELAY_MS = 700;

const config = useRuntimeConfig();
const colorMode = useColorMode();

const isOpen = computed(() => Boolean(props.payload));

const sizeLabel = computed(() => (props.payload ? formatSizeMB(props.payload.estimatedBytes) : ""));

const areaLabel = computed(() => {
  if (!props.payload)
    return "";
  const area = bboxAreaKm2(props.payload.bbox);
  if (area < 1)
    return "< 1 км²";
  if (area >= 1000)
    return `${Math.round(area / 100) * 100} км²`;
  return `${Math.round(area)} км²`;
});

const dimensionsLabel = computed(() => {
  if (!props.payload)
    return "";
  const [w, s, e, n] = props.payload.bbox;
  const midLat = (s + n) / 2;
  const widthKm = Math.max(1, Math.round((e - w) * KM_PER_DEGREE_LAT * Math.cos((midLat * Math.PI) / 180)));
  const heightKm = Math.max(1, Math.round((n - s) * KM_PER_DEGREE_LAT));
  return `${widthKm} × ${heightKm} км`;
});

const previewUrl = computed(() => {
  if (!props.payload)
    return null;
  const token = config.public.mapboxToken;
  if (!token)
    return null;
  const [w, s, e, n] = props.payload.bbox;
  const styleId = colorMode.value === "light" ? "outdoors-v12" : "dark-v11";
  const bboxParam = `%5B${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}%5D`;
  return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${bboxParam}/600x320@2x?access_token=${token}`;
});

const offlineRegions = useOfflineRegions();

const currentUsedBytes = computed(() =>
  offlineRegions.regions.value.reduce((sum, region) => sum + (region.actualBytes || region.estimatedBytes), 0),
);

const projectedTotalBytes = computed(() => {
  if (!props.payload)
    return currentUsedBytes.value;
  return currentUsedBytes.value + props.payload.estimatedBytes;
});

const sizeQuotaPercent = computed(() =>
  Math.min(100, Math.round((projectedTotalBytes.value / STORAGE_LIMIT_BYTES) * 100)),
);

type QuotaWarning = "exceeds-cap" | "near-cap" | "large-single" | null;

const LARGE_SINGLE_REGION_BYTES = 100 * 1024 * 1024;
const NEAR_CAP_FRACTION = 0.8;

const quotaWarning = computed<QuotaWarning>(() => {
  if (!props.payload)
    return null;
  if (projectedTotalBytes.value > STORAGE_LIMIT_BYTES)
    return "exceeds-cap";
  if (projectedTotalBytes.value > STORAGE_LIMIT_BYTES * NEAR_CAP_FRACTION)
    return "near-cap";
  if (props.payload.estimatedBytes > LARGE_SINGLE_REGION_BYTES)
    return "large-single";
  return null;
});

const quotaBlocked = computed(() => quotaWarning.value === "exceeds-cap");

const quotaMessage = computed(() => {
  switch (quotaWarning.value) {
    case "exceeds-cap":
      return `Превышает лимит 200 МБ. Сейчас занято ${formatSizeMB(currentUsedBytes.value)}; освободите место в менеджере перед загрузкой.`;
    case "near-cap":
      return `Регион доводит хранилище до ${sizeQuotaPercent.value}% от лимита. Можно скачать, но скоро придётся чистить.`;
    case "large-single":
      return "Регион крупный — загрузка может занять несколько минут на медленной сети.";
    default:
      return "";
  }
});

const includedItems = computed(() => [
  { icon: "tabler:map-pin", label: "Векторная карта региона" },
  { icon: "tabler:flag", label: `${props.payload?.pointCount ?? 0} точек маршрута с метаданными` },
  { icon: "tabler:route", label: "Дорожный маршрут между точками" },
]);

const excludedItems = [
  { icon: "tabler:sparkles", label: "AI-истории о местах" },
  { icon: "tabler:users", label: "Социальная лента и комментарии" },
  { icon: "tabler:cloud-off", label: "Загрузка новых фото" },
  { icon: "tabler:search", label: "Поиск мест и геокодинг" },
  { icon: "tabler:cloud-snow", label: "Прогноз погоды" },
];

const saveState = ref<SaveState>("idle");
const saveError = ref<string | null>(null);
const activeRegionId = ref<string | null>(null);
let savedCloseTimer: ReturnType<typeof setTimeout> | null = null;

const activeRegion = computed(() => {
  if (!activeRegionId.value)
    return null;
  return offlineRegions.regions.value.find(r => r.id === activeRegionId.value) ?? null;
});

const totalTilesPreview = computed(() => {
  if (!props.payload)
    return 0;
  return countTiles(props.payload.bbox);
});

const progressPercent = computed(() => {
  const region = activeRegion.value;
  if (!region || !region.totalTiles)
    return 0;
  return Math.min(100, Math.round(((region.tilesDone ?? 0) / region.totalTiles) * 100));
});

const downloadedSizeLabel = computed(() => {
  const region = activeRegion.value;
  if (!region)
    return "";
  return formatSizeMB(region.actualBytes);
});

const tilesProgressLabel = computed(() => {
  const region = activeRegion.value;
  if (!region || !region.totalTiles)
    return "";
  return `${region.tilesDone ?? 0} / ${region.totalTiles} тайлов`;
});

async function onConfirm() {
  if (!props.payload)
    return;
  if (saveState.value === "saving" || saveState.value === "downloading")
    return;

  saveState.value = "saving";
  saveError.value = null;

  const payload = props.payload;
  let region;
  try {
    region = await offlineRegions.add({
      bbox: payload.bbox,
      estimatedBytes: payload.estimatedBytes,
      pointCount: payload.pointCount,
      regionLabel: props.regionLabel ?? null,
      status: "metadata",
      totalTiles: totalTilesPreview.value,
    });
    activeRegionId.value = region.id;
    emit("confirm", payload);
  }
  catch (error) {
    saveState.value = "error";
    saveError.value = error instanceof Error ? error.message : "Не удалось сохранить регион";
    toast.error("Не удалось сохранить регион", { description: saveError.value });
    return;
  }

  saveState.value = "downloading";

  try {
    const result = await offlineRegions.download(region.id, payload.bbox);
    if (result.cancelled) {
      // User aborted — drop the partially-downloaded region entirely
      // so they don't end up with a half-cooked entry in the manager.
      await offlineRegions.remove(region.id);
      activeRegionId.value = null;
      saveState.value = "idle";
      toast("Загрузка отменена");
      emit("close");
      return;
    }
    saveState.value = "complete";
    toast.success("Регион доступен офлайн", {
      description: `Скачано ${formatSizeMB(result.bytesDone)} · ${result.tilesDone} тайлов.`,
    });
    savedCloseTimer = setTimeout(() => {
      emit("close");
    }, SAVED_CLOSE_DELAY_MS);
  }
  catch (error) {
    saveState.value = "error";
    saveError.value = error instanceof Error ? error.message : "Не удалось скачать тайлы";
    toast.error("Не удалось скачать тайлы", { description: saveError.value });
  }
}

function onClose() {
  if (saveState.value === "saving")
    return;
  if (saveState.value === "downloading" && activeRegionId.value) {
    // Signal cancellation and let the in-flight `download()` promise
    // unwind through its own cleanup path (which will call emit("close")).
    offlineRegions.cancelDownload(activeRegionId.value);
    return;
  }
  emit("close");
}

function clearSavedCloseTimer() {
  if (!savedCloseTimer)
    return;
  clearTimeout(savedCloseTimer);
  savedCloseTimer = null;
}

watch(() => props.payload, (next) => {
  clearSavedCloseTimer();
  if (next) {
    saveState.value = "idle";
    activeRegionId.value = null;
  }
  saveError.value = null;
});

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value)
    onClose();
}

onMounted(() => {
  if (typeof window === "undefined")
    return;
  window.addEventListener("keydown", onEscape);
});

onBeforeUnmount(() => {
  clearSavedCloseTimer();
  if (typeof window === "undefined")
    return;
  window.removeEventListener("keydown", onEscape);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="offline-sheet">
      <div
        v-if="isOpen && payload"
        class="fixed inset-0 z-[80] flex max-md:items-end md:items-stretch md:justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-sheet-title"
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
          class="offline-sheet-panel explore-panel relative flex w-full flex-col overflow-hidden border max-md:max-h-[88dvh] max-md:rounded-t-2xl md:max-w-[480px] md:rounded-l-2xl"
        >
          <!-- Header -->
          <header class="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--explore-border)] px-5 py-4">
            <div class="min-w-0">
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--explore-accent-strong)]">
                Офлайн-карта
              </p>
              <h2 id="offline-sheet-title" class="mt-1 truncate text-base font-bold text-[var(--explore-text)]">
                Скачать регион
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
          </header>

          <!-- Body -->
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <!-- Preview -->
            <div class="overflow-hidden rounded-xl border border-[var(--explore-border)] bg-[var(--explore-surface-soft)]">
              <div class="relative aspect-[16/9] w-full bg-[var(--explore-surface-hover)]">
                <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  :alt="`Превью региона ${regionLabel ?? dimensionsLabel}`"
                  class="h-full w-full object-cover"
                  loading="lazy"
                >
                <div v-else class="flex h-full w-full items-center justify-center">
                  <Icon
                    name="tabler:map"
                    class="text-[var(--explore-text-faint)]"
                    size="48"
                  />
                </div>
                <div class="pointer-events-none absolute inset-3 rounded-lg border-2 border-dashed border-[var(--explore-accent-strong)]/55" />
              </div>
              <div class="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span class="truncate font-bold text-[var(--explore-text)]">{{ regionLabel ?? "Регион маршрута" }}</span>
                <span class="shrink-0 font-mono text-[var(--explore-text-muted)]">{{ dimensionsLabel }} · {{ areaLabel }}</span>
              </div>
            </div>

            <!-- Quota warning / error banner -->
            <div
              v-if="quotaWarning"
              class="rounded-xl border px-4 py-3 text-xs"
              :class="{
                'explore-status-danger': quotaWarning === 'exceeds-cap',
                'explore-status-warning': quotaWarning === 'near-cap' || quotaWarning === 'large-single',
              }"
              role="status"
            >
              <div class="flex items-start gap-2">
                <Icon
                  :name="quotaWarning === 'exceeds-cap' ? 'tabler:alert-octagon' : 'tabler:alert-triangle'"
                  size="14"
                  class="mt-0.5 shrink-0"
                />
                <p class="font-medium leading-5">
                  {{ quotaMessage }}
                </p>
              </div>
            </div>

            <!-- Size + quota -->
            <div class="rounded-xl border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] p-4">
              <div class="mb-2 flex items-baseline justify-between gap-2">
                <span class="text-2xl font-bold text-[var(--explore-text)]">≈ {{ sizeLabel }}</span>
                <span
                  class="font-mono text-[10px]"
                  :class="quotaBlocked ? 'text-[var(--explore-danger-text)]' : 'text-[var(--explore-text-soft)]'"
                >
                  {{ sizeQuotaPercent }}% от лимита (~200 МБ)
                </span>
              </div>
              <div class="explore-progress-track h-1.5 overflow-hidden rounded-full">
                <div
                  class="h-full rounded-full transition-all"
                  :class="quotaBlocked ? 'bg-[var(--explore-danger-text)]' : (quotaWarning === 'near-cap' ? 'bg-[var(--explore-warning-text)]' : 'bg-[var(--explore-primary-bg)]')"
                  :style="{ width: `${sizeQuotaPercent}%` }"
                />
              </div>
              <p
                v-if="currentUsedBytes > 0"
                class="mt-2 font-mono text-[10px] text-[var(--explore-text-faint)]"
              >
                Уже занято {{ formatSizeMB(currentUsedBytes) }} · добавится {{ formatSizeMB(payload?.estimatedBytes ?? 0) }} · итого {{ formatSizeMB(projectedTotalBytes) }}
              </p>
            </div>

            <!-- Included -->
            <div>
              <h3 class="explore-section-label mb-2 text-[11px] font-bold uppercase tracking-[0.2em]">
                Будет доступно офлайн
              </h3>
              <ul class="space-y-1.5">
                <li
                  v-for="item in includedItems"
                  :key="item.label"
                  class="flex items-center gap-2.5 rounded-lg bg-[var(--explore-success-bg)] px-3 py-2 text-xs text-[var(--explore-success-text)]"
                >
                  <Icon
                    name="tabler:check"
                    size="14"
                    class="shrink-0"
                  />
                  <Icon
                    :name="item.icon"
                    size="14"
                    class="shrink-0 opacity-70"
                  />
                  <span class="font-medium">{{ item.label }}</span>
                </li>
              </ul>
            </div>

            <!-- Excluded -->
            <div>
              <h3 class="explore-section-label mb-2 text-[11px] font-bold uppercase tracking-[0.2em]">
                Останется недоступно
              </h3>
              <ul class="space-y-1.5">
                <li
                  v-for="item in excludedItems"
                  :key="item.label"
                  class="flex items-center gap-2.5 rounded-lg bg-[var(--explore-warning-bg)] px-3 py-2 text-xs text-[var(--explore-warning-text)]"
                >
                  <Icon
                    name="tabler:circle-off"
                    size="14"
                    class="shrink-0"
                  />
                  <Icon
                    :name="item.icon"
                    size="14"
                    class="shrink-0 opacity-70"
                  />
                  <span class="font-medium">{{ item.label }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Footer (sticky) -->
          <footer class="shrink-0 border-t border-[var(--explore-border)] bg-[var(--explore-surface)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <!-- Progress bar appears only while we're streaming tiles. -->
            <div
              v-if="saveState === 'downloading'"
              class="mb-3"
            >
              <div class="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
                <span class="font-bold text-[var(--explore-text)]">
                  Скачивание · {{ progressPercent }}%
                </span>
                <span class="font-mono text-[var(--explore-text-muted)]">
                  {{ downloadedSizeLabel }} · {{ tilesProgressLabel }}
                </span>
              </div>
              <div class="explore-progress-track h-1.5 overflow-hidden rounded-full">
                <div
                  class="h-full rounded-full bg-[var(--explore-primary-bg)] transition-all"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
            </div>

            <div class="grid grid-cols-[1fr_2fr] gap-2">
              <button
                type="button"
                class="explore-icon-button h-11 rounded-xl border text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="saveState === 'saving' || saveState === 'complete'"
                @click="onClose"
              >
                {{ saveState === "downloading" ? "Отменить" : "Отмена" }}
              </button>
              <button
                type="button"
                class="explore-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="(saveState !== 'idle' && saveState !== 'error') || quotaBlocked"
                @click="onConfirm"
              >
                <template v-if="saveState === 'saving'">
                  <Icon
                    name="tabler:loader-2"
                    size="16"
                    class="animate-spin"
                  />
                  <span>Сохраняем…</span>
                </template>
                <template v-else-if="saveState === 'downloading'">
                  <Icon
                    name="tabler:loader-2"
                    size="16"
                    class="animate-spin"
                  />
                  <span>Тайлы качаются…</span>
                </template>
                <template v-else-if="saveState === 'complete'">
                  <Icon name="tabler:check" size="16" />
                  <span>Готово · {{ downloadedSizeLabel }}</span>
                </template>
                <template v-else-if="saveState === 'error'">
                  <Icon name="tabler:reload" size="16" />
                  <span>Повторить</span>
                </template>
                <template v-else>
                  <Icon name="tabler:download" size="16" />
                  <span>Скачать {{ sizeLabel }}</span>
                </template>
              </button>
            </div>
            <p
              v-if="saveState === 'error' && saveError"
              class="mt-2 text-center text-[10px] text-[var(--explore-danger-text)]"
            >
              {{ saveError }}
            </p>
            <p
              v-else-if="saveState === 'downloading'"
              class="mt-2 text-center text-[10px] text-[var(--explore-text-faint)]"
            >
              Не закрывайте окно — тайлы стримятся из PMTiles-архива.
            </p>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.offline-sheet-panel {
  box-shadow: 0 -16px 60px var(--explore-overlay-shadow);
}

.offline-sheet-enter-active,
.offline-sheet-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-sheet-enter-active .offline-sheet-panel,
.offline-sheet-leave-active .offline-sheet-panel {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.offline-sheet-enter-from,
.offline-sheet-leave-to {
  opacity: 0;
}

.offline-sheet-enter-from .offline-sheet-panel,
.offline-sheet-leave-to .offline-sheet-panel {
  transform: translateY(100%);
}

@media (min-width: 768px) {
  .offline-sheet-enter-from .offline-sheet-panel,
  .offline-sheet-leave-to .offline-sheet-panel {
    transform: translateY(0) translateX(100%);
  }
}
</style>
