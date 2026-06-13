<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";
import type { OfflineRegion } from "~/lib/offline/region-store";

import { createMarkerElement, createPopupHTML } from "~/components/explore/route-marker";
import { formatRouteDistance, getRouteDayGroups } from "~/lib/explore/route-map";
import { ensureOfflineProtocol } from "~/lib/offline/maplibre-protocol";
import { buildOfflineStyle } from "~/lib/offline/offline-style";

// Modal preview that renders a saved region's tiles via MapLibre +
// the `idb-offline://` custom protocol. The map is created on open and
// destroyed on close — no shared instance because previews are
// short-lived and one-at-a-time.

const props = defineProps<{
  region: OfflineRegion | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const ROUTE_LINE_SOURCE_ID = "offline-route-line";
const ROUTE_LINE_LAYER_ID = "offline-route-line";

const colorMode = useColorMode();
const mapContainer = ref<HTMLElement | null>(null);
const mapLoaded = ref(false);
const initError = ref<string | null>(null);
let mapInstance: {
  remove: () => void;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
} | null = null;
let routeMarkers: Array<{ remove: () => void }> = [];

const isOpen = computed(() => Boolean(props.region));
const regionDisplayName = computed(() => {
  if (!props.region)
    return "";
  if (props.region.regionLabel)
    return props.region.regionLabel;
  return `Регион от ${new Date(props.region.dateAdded).toLocaleDateString("ru-RU")}`;
});

const tilesAvailable = computed(() => Boolean(props.region?.tilesDone));

const hasRoute = computed(() => Boolean(props.region?.routePoints?.length));

const dayGroups = computed(() =>
  props.region?.routePoints?.length ? getRouteDayGroups(props.region.routePoints) : [],
);

// List numbering must match the marker numbering (global order across days).
const pointNumbers = computed(() => {
  const numbers = new Map<string, number>();
  (props.region?.routePoints ?? []).forEach((point, index) => numbers.set(point.id, index + 1));
  return numbers;
});

function pointMetaLabel(point: RouteMapPoint): string {
  const parts: string[] = [];
  if (point.estimatedDurationMinutes)
    parts.push(`${point.estimatedDurationMinutes} мин`);
  const distance = formatRouteDistance(point.approximateDistanceMeters ?? null);
  if (distance)
    parts.push(distance);
  return parts.join(" · ");
}

function onPointClick(point: RouteMapPoint) {
  mapInstance?.flyTo({ center: [point.lng, point.lat], zoom: 15 });
}

async function initMap(region: OfflineRegion) {
  if (!mapContainer.value)
    return;

  mapLoaded.value = false;
  initError.value = null;

  try {
    await ensureOfflineProtocol();
    await import("maplibre-gl/dist/maplibre-gl.css");
    const maplibreModule = await import("maplibre-gl");
    const ml = (maplibreModule.default ?? maplibreModule) as typeof maplibreModule;

    const [west, south, east, north] = region.bbox;
    const theme = colorMode.value === "light" ? "light" : "dark";

    const map = new ml.Map({
      container: mapContainer.value,
      style: buildOfflineStyle(region.id, theme, region.maxZoom ?? 14) as never,
      bounds: [
        [west, south],
        [east, north],
      ],
      fitBoundsOptions: { padding: 24, animate: false },
      attributionControl: false,
    });

    map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");

    // Route overlay: GeoJSON line (road geometry captured at download time,
    // straight segments as fallback) + numbered HTML markers with popups.
    // HTML markers don't need glyphs, which the offline style deliberately
    // lacks; popups reuse the explore look (day badge + name).
    const renderRouteOverlay = () => {
      const points = region.routePoints ?? [];
      if (!points.length)
        return;

      const lineCoordinates = region.routeGeometry && region.routeGeometry.length >= 2
        ? region.routeGeometry
        : points.map(point => [point.lng, point.lat]);

      if (lineCoordinates.length >= 2) {
        map.addSource(ROUTE_LINE_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: lineCoordinates },
          },
        } as never);
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: "line",
          source: ROUTE_LINE_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#2dd4bf", "line-opacity": 0.9, "line-width": 4 },
        } as never);
      }

      points.forEach((point, index) => {
        const { element } = createMarkerElement(point, index, index * 40);
        const popup = new ml.Popup({ offset: 18, closeButton: false }).setHTML(createPopupHTML(point));
        const marker = new ml.Marker({ element })
          .setLngLat([point.lng, point.lat])
          .setPopup(popup)
          .addTo(map);
        routeMarkers.push(marker);
      });
    };

    map.on("load", () => {
      mapLoaded.value = true;
      renderRouteOverlay();
    });

    map.on("error", (event: { error?: { message?: string } }) => {
      // Suppress per-tile "missing" errors — they're expected for zoom
      // levels we didn't pre-fetch — but surface real init failures.
      const message = event.error?.message ?? "";
      if (message.includes("missing for region"))
        return;
      console.error("[offline-preview] map error:", message);
    });

    mapInstance = map;
  }
  catch (error) {
    initError.value = error instanceof Error ? error.message : "Не удалось открыть карту";
  }
}

function teardownMap() {
  for (const marker of routeMarkers)
    marker.remove();
  routeMarkers = [];
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  mapLoaded.value = false;
  initError.value = null;
}

function onClose() {
  emit("close");
}

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value)
    onClose();
}

watch(
  () => props.region,
  async (region) => {
    teardownMap();
    if (!region)
      return;
    await nextTick();
    await initMap(region);
  },
);

onMounted(() => {
  if (typeof window === "undefined")
    return;
  window.addEventListener("keydown", onEscape);
});

onBeforeUnmount(() => {
  teardownMap();
  if (typeof window === "undefined")
    return;
  window.removeEventListener("keydown", onEscape);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="region-preview">
      <div
        v-if="isOpen && region"
        class="fixed inset-0 z-[90] flex items-center justify-center p-3 md:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="region-preview-title"
      >
        <!-- Backdrop -->
        <button
          type="button"
          aria-label="Закрыть превью"
          class="absolute inset-0 bg-black/70 backdrop-blur-md"
          @click="onClose"
        />

        <!-- Panel -->
        <section
          class="region-preview-panel explore-panel relative flex h-full max-h-[calc(100dvh-24px)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border"
        >
          <!-- Header -->
          <header class="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--explore-border)] px-5 py-3">
            <div class="min-w-0">
              <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--explore-accent-strong)]">
                Офлайн-просмотр
              </p>
              <h2
                id="region-preview-title"
                class="mt-0.5 truncate text-sm font-bold text-[var(--explore-text)]"
              >
                {{ regionDisplayName }}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Закрыть превью"
              class="explore-icon-button flex h-9 w-9 items-center justify-center rounded-xl border"
              @click="onClose"
            >
              <Icon name="tabler:x" size="16" />
            </button>
          </header>

          <!-- Body: map + route point list -->
          <div class="flex min-h-0 flex-1 max-md:flex-col">
            <!-- Map canvas -->
            <div class="relative min-h-0 flex-1 bg-[var(--explore-surface-hover)]">
              <div
                ref="mapContainer"
                class="h-full w-full"
              />

              <!-- Loading scrim -->
              <div
                v-if="!mapLoaded && !initError"
                class="explore-loading-scrim pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2"
              >
                <Icon
                  name="tabler:loader-2"
                  size="32"
                  class="animate-spin text-brand-gold"
                />
                <p class="explore-text-soft font-mono text-[10px] uppercase tracking-[0.24em]">
                  Рендер из IndexedDB
                </p>
              </div>

              <!-- Empty / error -->
              <div
                v-if="initError || !tilesAvailable"
                class="absolute inset-x-0 bottom-3 mx-auto max-w-md rounded-xl border border-[var(--explore-warning-border)] bg-[var(--explore-warning-bg)] px-4 py-3 text-center text-xs text-[var(--explore-warning-text)]"
              >
                <p v-if="initError" class="font-bold">
                  {{ initError }}
                </p>
                <p v-else class="font-bold">
                  Тайлы ещё не скачаны для этого региона
                </p>
                <p class="mt-1 opacity-80">
                  Откройте sheet «Скачать офлайн» и дождитесь завершения загрузки.
                </p>
              </div>
            </div>

            <!-- Route point list -->
            <aside
              v-if="hasRoute"
              class="shrink-0 overflow-y-auto border-[var(--explore-border)] max-md:max-h-[38%] max-md:border-t md:w-[280px] md:border-l"
              aria-label="Точки маршрута"
            >
              <div
                v-for="group in dayGroups"
                :key="group.day"
                class="px-4 py-3"
              >
                <p class="explore-section-label mb-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                  День {{ group.day }}
                </p>
                <ul class="space-y-1">
                  <li v-for="point in group.points" :key="point.id">
                    <button
                      type="button"
                      class="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--explore-surface-hover)]"
                      :aria-label="`Показать на карте: ${point.name}`"
                      @click="onPointClick(point)"
                    >
                      <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--explore-marker-generated)] text-[10px] font-bold text-[var(--explore-primary-text)]">
                        {{ pointNumbers.get(point.id) }}
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-xs font-bold text-[var(--explore-text)]">{{ point.name }}</span>
                        <span
                          v-if="pointMetaLabel(point)"
                          class="block font-mono text-[10px] text-[var(--explore-text-soft)]"
                        >
                          {{ pointMetaLabel(point) }}
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          <!-- Footer -->
          <footer class="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--explore-border)] px-5 py-2.5 text-[11px] text-[var(--explore-text-muted)]">
            <span class="font-mono">
              {{ region.tilesDone ?? 0 }} тайлов · {{ Math.round(region.actualBytes / 1024 / 1024 * 10) / 10 }} МБ
            </span>
            <span
              v-if="!hasRoute"
              class="text-[var(--explore-text-faint)]"
            >
              Маршрут не сохранён — скачайте регион заново
            </span>
            <span class="font-mono text-[var(--explore-text-faint)]">
              idb-offline://{{ region.id.slice(0, 8) }}…
            </span>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.region-preview-panel {
  box-shadow: 0 24px 80px var(--explore-overlay-shadow);
}

.region-preview-enter-active,
.region-preview-leave-active {
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.region-preview-enter-active .region-preview-panel,
.region-preview-leave-active .region-preview-panel {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.region-preview-enter-from,
.region-preview-leave-to {
  opacity: 0;
}

.region-preview-enter-from .region-preview-panel,
.region-preview-leave-to .region-preview-panel {
  transform: scale(0.96);
}
</style>
