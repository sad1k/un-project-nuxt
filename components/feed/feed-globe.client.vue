<script lang="ts" setup>
import type { PublicFeedGlobePost } from "~/composables/use-feed-globe";
import type { FeedGlobeOverflowIndicator } from "~/lib/feed/globe-density";

const props = withDefaults(defineProps<{
  realistic?: boolean;
  hideChrome?: boolean;
  zoom?: number;
  spinSpeed?: number;
}>(), {
  realistic: false,
  hideChrome: false,
  zoom: 1.35,
  spinSpeed: 0.004,
});

const config = useRuntimeConfig();
const colorMode = useColorMode();
const globe = useFeedGlobe();

const mapContainer = ref<HTMLElement | null>(null);
const mapLoaded = ref(false);
const mapError = ref("");
const markers: GlobeMarker[] = [];
const overflowMarkers: GlobeMarker[] = [];

type GlobeMarker = {
  element: HTMLElement;
  lat: number;
  long: number;
  marker: any;
};

let mapboxModule: any = null;
let map: any = null;
let spinFrame: number | null = null;
let popup: any = null;
let hoverPopup: any = null;
let resizeObserver: ResizeObserver | null = null;

const hasMapboxToken = computed(() => typeof config.public.mapboxToken === "string" && config.public.mapboxToken.length > 0);
const visibleCount = computed(() => globe.visiblePoints.value.length);
const hiddenCount = computed(() => globe.hiddenPointIds.value.length);
const loading = computed(() => globe.loading.value);
const error = computed(() => globe.error.value);
const isDarkTheme = computed(() => colorMode.value === "dark");
const mapStyle = computed(() => {
  if (props.realistic)
    return "mapbox://styles/mapbox/satellite-streets-v12";

  return isDarkTheme.value ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11";
});
const themeClass = computed(() => isDarkTheme.value ? "feed-globe--dark" : "feed-globe--light");
const showFallbackGlobe = computed(() => !hasMapboxToken.value || !mapLoaded.value || Boolean(mapError.value));
const fallbackPoints = computed(() => globe.visiblePoints.value.map(point => ({
  id: point.id,
  label: point.post.place.name,
  x: Math.min(94, Math.max(6, ((point.long + 180) / 360) * 100)),
  y: Math.min(88, Math.max(12, ((90 - point.lat) / 180) * 100)),
  fading: globe.fadingPointIds.value.includes(point.id),
  post: point.post,
  authorName: point.post.author.name,
  authorImage: point.post.author.image,
  authorInitial: point.post.author.name.trim().slice(0, 1).toUpperCase() || "?",
})));
const fallbackOverflow = computed(() => globe.overflowIndicators.value.map(indicator => ({
  id: indicator.id,
  count: indicator.hiddenCount,
  x: Math.min(94, Math.max(6, ((indicator.long + 180) / 360) * 100)),
  y: Math.min(88, Math.max(12, ((90 - indicator.lat) / 180) * 100)),
})));
const fallbackStatus = computed(() => {
  if (!hasMapboxToken.value)
    return "Mapbox token is unavailable. Showing live fallback globe.";

  if (mapError.value)
    return "Mapbox не загрузился, показываем live-глобус.";

  return "Загрузка глобуса...";
});

onMounted(async () => {
  await globe.refresh();
  globe.startLiveUpdates();
  if (hasMapboxToken.value)
    await initMap();
});

watch([globe.visiblePoints, globe.overflowIndicators], () => {
  renderMarkers();
  focusMapOnPoints();
}, { deep: true });

watch(mapStyle, () => {
  if (!map)
    return;

  mapLoaded.value = false;
  closeSelectedPhotoPopup();
  closeHoverPopup();
  stopSpin();
  map.setStyle(mapStyle.value);
});

onBeforeUnmount(() => {
  stopSpin();
  clearMarkers();
  closeSelectedPhotoPopup();
  closeHoverPopup();
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
  globe.stopLiveUpdates();
});

async function getMapboxGL() {
  if (!mapboxModule) {
    await import("mapbox-gl/dist/mapbox-gl.css");
    mapboxModule = await import("mapbox-gl");
  }
  return mapboxModule.default || mapboxModule;
}

async function initMap() {
  if (!mapContainer.value || map)
    return;

  try {
    const mb = await getMapboxGL();
    mb.accessToken = config.public.mapboxToken;

    map = new mb.Map({
      container: mapContainer.value,
      style: mapStyle.value,
      projection: "globe",
      center: [30, 15],
      zoom: props.zoom,
      pitch: 28,
      bearing: -18,
      attributionControl: !props.hideChrome,
    });

    const markReady = () => {
      applyThemeFog();
      if (props.hideChrome)
        hideLabels();
      mapError.value = "";
      mapLoaded.value = true;
      resizeMap();
      focusMapOnPoints();
      renderMarkers();
      startSpin();
    };

    if (props.hideChrome) {
      // decorative hero globe — disable interaction so the spin never gets interrupted
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.dragRotate.disable();
      map.keyboard.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    }
    else {
      map.addControl(new mb.NavigationControl(), "bottom-right");
    }

    map.once("load", markReady);
    map.on("style.load", markReady);
    map.on("error", () => {
      mapError.value = "Mapbox globe failed to load";
      mapLoaded.value = false;
      stopSpin();
    });

    if (!props.hideChrome) {
      const pauseSpin = () => stopSpin();
      map.on("mousedown", pauseSpin);
      map.on("touchstart", pauseSpin);
      map.on("wheel", pauseSpin);
      map.on("click", closeSelectedPhotoPopup);
    }
    map.on("move", updateMarkerVisibility);
    map.on("rotate", updateMarkerVisibility);
    map.on("zoom", updateMarkerVisibility);

    resizeObserver = new ResizeObserver(() => {
      resizeMap();
    });
    resizeObserver.observe(mapContainer.value);
    await nextTick();
    resizeMap();
  }
  catch {
    mapError.value = "Mapbox globe failed to load";
    mapLoaded.value = false;
  }
}

function applyThemeFog() {
  if (!map)
    return;

  if (props.realistic) {
    map.setFog(props.hideChrome
      ? {
          // hero usage — transparent space so the page's cosmic backdrop shows through
          "color": "rgba(36, 92, 156, 0)",
          "high-color": "rgba(80, 130, 210, 0.35)",
          "horizon-blend": 0.04,
          "space-color": "rgba(0, 0, 0, 0)",
          "star-intensity": 0,
        }
      : {
          "color": "rgb(8, 12, 22)",
          "high-color": "rgb(36, 92, 156)",
          "horizon-blend": 0.06,
          "space-color": "rgb(2, 6, 23)",
          "star-intensity": 0.55,
        });
    return;
  }

  map.setFog(isDarkTheme.value
    ? {
        "color": "rgb(5, 8, 15)",
        "high-color": "rgb(12, 28, 46)",
        "horizon-blend": 0.08,
        "space-color": "rgb(2, 6, 23)",
        "star-intensity": 0.28,
      }
    : {
        "color": "rgb(239, 246, 255)",
        "high-color": "rgb(186, 230, 253)",
        "horizon-blend": 0.12,
        "space-color": "rgb(248, 250, 252)",
        "star-intensity": 0,
      });
}

function hideLabels() {
  if (!map)
    return;

  const layers = map.getStyle()?.layers;
  if (!layers)
    return;

  for (const layer of layers) {
    if (layer.type === "symbol") {
      try {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
      catch {
        // some layers (e.g. terrain) can't be toggled — skip silently
      }
    }
  }
}

async function renderMarkers() {
  if (!map || !mapLoaded.value)
    return;

  resizeMap();
  clearMarkers();

  if (props.hideChrome)
    return;
  const mb = await getMapboxGL();

  for (const point of globe.visiblePoints.value) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = [
      "feed-globe-point",
      globe.fadingPointIds.value.includes(point.id) ? "feed-globe-point--fading" : "",
    ].join(" ");
    element.setAttribute("aria-label", point.post.place.name);
    element.addEventListener("mouseenter", () => {
      closeHoverPopup();
      hoverPopup = new mb.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "feed-globe-avatar-popup",
        offset: 24,
        maxWidth: "120px",
      })
        .setLngLat([point.long, point.lat])
        .setHTML(createAvatarPopupHTML(point.post))
        .addTo(map);
    });
    element.addEventListener("mouseleave", closeHoverPopup);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      closeHoverPopup();
      globe.selectPost(point.post);
      popup?.remove();
      popup = new mb.Popup({
        closeButton: true,
        closeOnClick: true,
        className: "feed-globe-photo-popup",
        offset: 18,
        maxWidth: "min(280px, calc(100vw - 32px))",
      })
        .setLngLat([point.long, point.lat])
        .setHTML(createPopupHTML(point.post))
        .addTo(map);
      popup.on("close", () => {
        globe.selectPost(null);
        popup = null;
      });
    });

    const marker = new mb.Marker({ element })
      .setLngLat([point.long, point.lat])
      .addTo(map);
    markers.push({ element, lat: point.lat, long: point.long, marker });
  }

  for (const indicator of globe.overflowIndicators.value)
    renderOverflowMarker(mb, indicator);

  updateMarkerVisibility();
}

function renderOverflowMarker(mb: any, indicator: FeedGlobeOverflowIndicator) {
  const element = document.createElement("span");
  element.className = "feed-globe-overflow";
  element.textContent = `+${indicator.hiddenCount}`;
  element.setAttribute("aria-label", `+${indicator.hiddenCount}`);

  const marker = new mb.Marker({ element })
    .setLngLat([indicator.long, indicator.lat])
    .addTo(map);
  overflowMarkers.push({ element, lat: indicator.lat, long: indicator.long, marker });
}

function clearMarkers() {
  closeHoverPopup();
  markers.forEach(marker => marker.marker.remove());
  overflowMarkers.forEach(marker => marker.marker.remove());
  markers.length = 0;
  overflowMarkers.length = 0;
}

function closeSelectedPhotoPopup() {
  popup?.remove();
  popup = null;
  globe.selectPost(null);
}

function closeHoverPopup() {
  hoverPopup?.remove();
  hoverPopup = null;
}

function resizeMap() {
  if (!map)
    return;

  map.resize();
  updateMarkerVisibility();
}

function focusMapOnPoints() {
  if (props.hideChrome) // hero mode — never re-center, keep spinning freely
    return;
  if (!map || globe.visiblePoints.value.length === 0)
    return;

  const points = globe.visiblePoints.value;
  const averageLong = points.reduce((sum, point) => sum + point.long, 0) / points.length;
  const averageLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;

  map.easeTo({
    center: [averageLong, averageLat],
    zoom: points.length === 1 ? 2.2 : 1.45,
    pitch: 12,
    bearing: 0,
    duration: 900,
    essential: true,
  });
}

function startSpin() {
  stopSpin();
  const spin = () => {
    if (!map || map.getZoom() >= 4)
      return;

    const center = map.getCenter();
    center.lng += props.spinSpeed;
    map.setCenter(center);
    updateMarkerVisibility();
    spinFrame = requestAnimationFrame(spin);
  };
  spinFrame = requestAnimationFrame(spin);
}

function stopSpin() {
  if (spinFrame !== null) {
    cancelAnimationFrame(spinFrame);
    spinFrame = null;
  }
}

function createPopupHTML(post: PublicFeedGlobePost) {
  const date = new Date(post.createdAt).toLocaleDateString();

  return `
    <article class="feed-globe-photo-card ${isDarkTheme.value ? "feed-globe-photo-card--dark" : "feed-globe-photo-card--light"}">
      <img src="${escapeHtml(post.image.url)}" alt="${escapeHtml(post.image.alt)}" class="feed-globe-photo-card__image" />
      <div class="feed-globe-photo-card__body">
        <p class="feed-globe-photo-card__place">${escapeHtml(post.place.name)}</p>
        <p class="feed-globe-photo-card__author">${escapeHtml(post.author.name)}</p>
        <p class="feed-globe-photo-card__date">${escapeHtml(date)}</p>
      </div>
    </article>
  `;
}

function createAvatarPopupHTML(post: PublicFeedGlobePost) {
  const initials = post.author.name.trim().slice(0, 1).toUpperCase() || "?";
  const avatar = post.author.image
    ? `<img src="${escapeHtml(post.author.image)}" alt="${escapeHtml(post.author.name)}" class="feed-globe-avatar-popup__image" />`
    : `<span class="feed-globe-avatar-popup__initial">${escapeHtml(initials)}</span>`;

  return `
    <div class="feed-globe-avatar-popup__body">
      <div class="feed-globe-avatar-popup__ring">
        ${avatar}
      </div>
      <span class="feed-globe-avatar-popup__name">${escapeHtml(post.author.name)}</span>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function updateMarkerVisibility() {
  if (!map)
    return;

  const center = map.getCenter();
  for (const marker of [...markers, ...overflowMarkers]) {
    const isVisible = isCoordinateFacingCamera(marker.long, marker.lat, center.lng, center.lat);
    marker.element.classList.toggle("feed-globe-marker--hidden", !isVisible);
  }
}

function isCoordinateFacingCamera(pointLong: number, pointLat: number, centerLong: number, centerLat: number) {
  const pointLatRad = degreesToRadians(pointLat);
  const centerLatRad = degreesToRadians(centerLat);
  const deltaLongRad = degreesToRadians(pointLong - centerLong);
  const dotProduct = Math.sin(pointLatRad) * Math.sin(centerLatRad)
    + Math.cos(pointLatRad) * Math.cos(centerLatRad) * Math.cos(deltaLongRad);

  return dotProduct > 0.02;
}

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}
</script>

<template>
  <section
    class="relative overflow-hidden"
    :class="[
      themeClass,
      hideChrome
        ? 'feed-globe--hero h-full w-full bg-transparent'
        : 'h-[calc(100vh-12rem)] min-h-[520px] rounded-lg border border-gray-200 bg-slate-50 dark:border-white/10 dark:bg-[#050505]',
    ]"
  >
    <div
      ref="mapContainer"
      class="absolute inset-0 transition-opacity duration-300"
      :class="showFallbackGlobe ? 'opacity-0' : 'opacity-100'"
    />

    <div v-if="showFallbackGlobe" class="feed-globe-fallback absolute inset-0">
      <div class="feed-globe-fallback__stars" />
      <div class="feed-globe-fallback__sphere">
        <button
          v-for="point in fallbackPoints"
          :key="point.id"
          class="feed-globe-fallback__point"
          :class="{ 'feed-globe-fallback__point--fading': point.fading }"
          :style="{ left: `${point.x}%`, top: `${point.y}%` }"
          type="button"
          :aria-label="point.label"
          :title="point.post.author.name"
          @click="globe.selectPost(point.post)"
        >
          <span class="feed-globe-fallback__avatar-popover">
            <span class="feed-globe-fallback__avatar-ring">
              <img
                v-if="point.authorImage"
                :src="point.authorImage"
                :alt="point.authorName"
                class="h-full w-full object-cover"
              >
              <span v-else>{{ point.authorInitial }}</span>
            </span>
            <span class="feed-globe-fallback__avatar-name">{{ point.authorName }}</span>
          </span>
        </button>
        <span
          v-for="indicator in fallbackOverflow"
          :key="indicator.id"
          class="feed-globe-fallback__overflow"
          :style="{ left: `${indicator.x}%`, top: `${indicator.y}%` }"
        >
          +{{ indicator.count }}
        </span>
      </div>
      <p class="absolute bottom-4 left-4 right-4 text-center text-xs text-white/55">
        {{ fallbackStatus }}
      </p>
    </div>

    <div v-if="!hideChrome" class="pointer-events-none absolute left-4 top-4 rounded-lg border border-slate-900/10 bg-white/70 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/45 dark:text-white/75">
      {{ visibleCount }} · +{{ hiddenCount }}
    </div>

    <div v-if="loading" class="absolute inset-0 grid place-items-center bg-white/30 text-sm text-slate-700 backdrop-blur-sm dark:bg-black/30 dark:text-white/70">
      Загрузка...
    </div>

    <div v-else-if="error" class="absolute inset-x-4 bottom-4 rounded-lg border border-rose-400/30 bg-rose-950/80 p-3 text-sm text-rose-100">
      {{ error }}
    </div>
  </section>
</template>

<style scoped>
.feed-globe-fallback {
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 50%, rgba(13, 148, 136, 0.2), transparent 38%),
    radial-gradient(circle at 70% 20%, rgba(246, 196, 83, 0.14), transparent 24%), #02040a;
}

.feed-globe--light .feed-globe-fallback {
  background:
    radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.18), transparent 40%),
    radial-gradient(circle at 70% 20%, rgba(246, 196, 83, 0.18), transparent 26%),
    linear-gradient(180deg, #eef8ff 0%, #f8fafc 100%);
}

.feed-globe-fallback__stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.42) 1px, transparent 1px),
    radial-gradient(circle, rgba(255, 255, 255, 0.22) 1px, transparent 1px);
  background-position:
    0 0,
    32px 48px;
  background-size:
    96px 96px,
    128px 128px;
  opacity: 0.5;
}

.feed-globe--light .feed-globe-fallback__stars {
  background-image:
    radial-gradient(circle, rgba(15, 23, 42, 0.18) 1px, transparent 1px),
    radial-gradient(circle, rgba(14, 116, 144, 0.12) 1px, transparent 1px);
  opacity: 0.38;
}

.feed-globe-fallback__sphere {
  position: relative;
  width: min(72vw, 560px);
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background:
    linear-gradient(90deg, transparent 49%, rgba(255, 255, 255, 0.14) 50%, transparent 51%),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.11) 0 1px, transparent 1px 48px),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 48px),
    radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.55), rgba(15, 118, 110, 0.32) 34%, rgba(3, 7, 18, 0.96) 72%);
  box-shadow:
    inset -42px -24px 80px rgba(0, 0, 0, 0.65),
    0 0 90px rgba(20, 184, 166, 0.22);
  animation: feed-globe-fallback-spin 18s linear infinite;
}

.feed-globe--light .feed-globe-fallback__sphere {
  border-color: rgba(15, 23, 42, 0.16);
  background:
    linear-gradient(90deg, transparent 49%, rgba(15, 23, 42, 0.1) 50%, transparent 51%),
    repeating-linear-gradient(90deg, rgba(15, 23, 42, 0.08) 0 1px, transparent 1px 48px),
    repeating-linear-gradient(0deg, rgba(15, 23, 42, 0.07) 0 1px, transparent 1px 48px),
    radial-gradient(
      circle at 35% 30%,
      rgba(125, 211, 252, 0.85),
      rgba(20, 184, 166, 0.32) 38%,
      rgba(226, 232, 240, 0.92) 74%
    );
  box-shadow:
    inset -42px -24px 80px rgba(15, 23, 42, 0.22),
    0 0 90px rgba(14, 165, 233, 0.24);
}

.feed-globe-fallback__sphere::before {
  position: absolute;
  inset: 8%;
  border-radius: inherit;
  background:
    radial-gradient(circle at 30% 35%, rgba(245, 158, 11, 0.34) 0 8%, transparent 9%),
    radial-gradient(circle at 58% 48%, rgba(34, 197, 94, 0.28) 0 12%, transparent 13%),
    radial-gradient(circle at 42% 62%, rgba(132, 204, 22, 0.2) 0 10%, transparent 11%);
  content: "";
  filter: blur(1px);
  opacity: 0.8;
}

.feed-globe--light .feed-globe-fallback__sphere::before {
  background:
    radial-gradient(circle at 30% 35%, rgba(34, 197, 94, 0.28) 0 8%, transparent 9%),
    radial-gradient(circle at 58% 48%, rgba(22, 163, 74, 0.26) 0 12%, transparent 13%),
    radial-gradient(circle at 42% 62%, rgba(234, 179, 8, 0.24) 0 10%, transparent 11%);
  opacity: 0.72;
}

.feed-globe-fallback__point,
.feed-globe-fallback__overflow {
  position: absolute;
  z-index: 1;
  transform: translate(-50%, -50%);
}

.feed-globe-fallback__point {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  background: #f6c453;
  box-shadow:
    0 0 0 8px rgba(246, 196, 83, 0.2),
    0 0 26px rgba(246, 196, 83, 0.5);
  cursor: pointer;
  animation: feed-globe-arrive 420ms ease-out both;
}

.feed-globe-fallback__avatar-popover {
  position: absolute;
  left: 50%;
  bottom: 28px;
  display: grid;
  min-width: 84px;
  place-items: center;
  gap: 5px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.84);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  color: white;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(6px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.feed-globe--light .feed-globe-fallback__avatar-popover {
  border-color: rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
}

.feed-globe-fallback__point:hover .feed-globe-fallback__avatar-popover,
.feed-globe-fallback__point:focus-visible .feed-globe-fallback__avatar-popover {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.feed-globe-fallback__avatar-ring {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  overflow: hidden;
  border: 2px solid #f6c453;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f7877, #2d1b4e);
  color: white;
  font-size: 15px;
  font-weight: 700;
}

.feed-globe-fallback__avatar-name {
  max-width: 92px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-globe-fallback__point--fading {
  opacity: 0.35;
}

.feed-globe-fallback__overflow {
  display: grid;
  min-width: 30px;
  height: 24px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  background: rgba(10, 16, 28, 0.86);
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.feed-globe--light .feed-globe-fallback__overflow {
  border-color: rgba(15, 23, 42, 0.18);
  background: rgba(255, 255, 255, 0.88);
  color: #0f172a;
}

:global(.feed-globe--hero .mapboxgl-ctrl-bottom-left),
:global(.feed-globe--hero .mapboxgl-ctrl-bottom-right) {
  display: none !important;
}

:global(.feed-globe-point) {
  width: 18px;
  height: 18px;
  display: block;
  border: 2px solid rgba(255, 255, 255, 0.88);
  border-radius: 999px;
  background: #f6c453;
  box-shadow:
    0 0 0 8px rgba(246, 196, 83, 0.18),
    0 12px 28px rgba(0, 0, 0, 0.36);
  cursor: pointer;
  animation: feed-globe-arrive 420ms ease-out both;
}

:global(.feed-globe-point--fading) {
  opacity: 0.35;
}

:global(.feed-globe-marker--hidden) {
  opacity: 0 !important;
  pointer-events: none !important;
}

:global(.feed-globe-overflow) {
  display: grid;
  min-width: 30px;
  height: 24px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  background: rgba(10, 16, 28, 0.86);
  color: white;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.34);
}

:global(.feed-globe--light .feed-globe-overflow) {
  border-color: rgba(15, 23, 42, 0.18);
  background: rgba(255, 255, 255, 0.88);
  color: #0f172a;
}

:global(.feed-globe-photo-card) {
  width: 16rem;
  overflow: hidden;
  border-radius: 0.75rem;
}

:global(.feed-globe-photo-card__image) {
  width: 100%;
  height: 9rem;
  object-fit: cover;
}

:global(.feed-globe-photo-card__body) {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
}

:global(.feed-globe-photo-card__place) {
  font-size: 0.875rem;
  font-weight: 700;
}

:global(.feed-globe-photo-card__author),
:global(.feed-globe-photo-card__date) {
  font-size: 0.75rem;
}

:global(.feed-globe-photo-card--dark) {
  background: #050505;
  color: white;
}

:global(.feed-globe-photo-card--dark .feed-globe-photo-card__author) {
  color: rgba(255, 255, 255, 0.65);
}

:global(.feed-globe-photo-card--dark .feed-globe-photo-card__date) {
  color: rgba(255, 255, 255, 0.45);
}

:global(.feed-globe-photo-card--light) {
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
}

:global(.feed-globe-photo-card--light .feed-globe-photo-card__author) {
  color: rgba(51, 65, 85, 0.78);
}

:global(.feed-globe-photo-card--light .feed-globe-photo-card__date) {
  color: rgba(71, 85, 105, 0.62);
}

:global(.feed-globe-photo-popup .mapboxgl-popup-content) {
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: transparent;
  box-shadow: 0 22px 46px rgba(0, 0, 0, 0.42);
}

:global(.feed-globe--light .feed-globe-photo-popup .mapboxgl-popup-content) {
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 22px 46px rgba(15, 23, 42, 0.2);
}

:global(.feed-globe-photo-popup .mapboxgl-popup-close-button) {
  top: 6px;
  right: 6px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  color: white;
  font-size: 18px;
  line-height: 1;
}

:global(.feed-globe--light .feed-globe-photo-popup .mapboxgl-popup-close-button) {
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}

:global(.feed-globe-photo-popup .mapboxgl-popup-tip) {
  border-top-color: rgba(5, 5, 5, 0.95);
  border-bottom-color: rgba(5, 5, 5, 0.95);
}

:global(.feed-globe-avatar-popup .mapboxgl-popup-content) {
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
}

:global(.feed-globe-avatar-popup .mapboxgl-popup-tip) {
  display: none;
}

:global(.feed-globe-avatar-popup__body) {
  display: grid;
  min-width: 84px;
  place-items: center;
  gap: 5px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.84);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  color: white;
}

:global(.feed-globe--light .feed-globe-avatar-popup__body) {
  border-color: rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  color: #0f172a;
}

:global(.feed-globe-avatar-popup__ring) {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  overflow: hidden;
  border: 2px solid #f6c453;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f7877, #2d1b4e);
}

:global(.feed-globe-avatar-popup__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:global(.feed-globe-avatar-popup__initial) {
  color: white;
  font-size: 16px;
  font-weight: 800;
}

:global(.feed-globe-avatar-popup__name) {
  max-width: 92px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes feed-globe-fallback-spin {
  from {
    background-position:
      0 0,
      0 0,
      0 0,
      0 0;
  }
  to {
    background-position:
      0 0,
      96px 0,
      0 48px,
      0 0;
  }
}

@keyframes feed-globe-arrive {
  from {
    opacity: 0;
    filter: brightness(1.6);
  }
  to {
    opacity: 1;
    filter: brightness(1);
  }
}
</style>
