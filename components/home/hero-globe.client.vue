<script lang="ts" setup>
const colorMode = useColorMode();
const globe = useFeedGlobe();

const palette = ["#F59E0B", "#8B5CF6", "#EC4899", "#10B981", "#3B82F6", "#06B6D4", "#EF4444"];

const fallbackArcs = [
  { order: 1, startLat: 48.8566, startLng: 2.3522, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.35, color: "#F59E0B" },
  { order: 2, startLat: 51.5074, startLng: -0.1278, endLat: 22.3193, endLng: 114.1694, arcAlt: 0.3, color: "#8B5CF6" },
  { order: 3, startLat: 52.52, startLng: 13.405, endLat: 37.5665, endLng: 126.978, arcAlt: 0.28, color: "#EC4899" },
  { order: 4, startLat: 40.7128, startLng: -74.006, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.4, color: "#10B981" },
  { order: 5, startLat: 34.0522, startLng: -118.2437, endLat: 19.4326, endLng: -99.1332, arcAlt: 0.18, color: "#F59E0B" },
  { order: 6, startLat: 49.2827, startLng: -123.1207, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.55, color: "#3B82F6" },
  { order: 7, startLat: 40.4168, startLng: -3.7038, endLat: 25.7617, endLng: -80.1918, arcAlt: 0.32, color: "#EF4444" },
  { order: 8, startLat: 55.7558, startLng: 37.6173, endLat: 40.7128, endLng: -74.006, arcAlt: 0.4, color: "#8B5CF6" },
  { order: 9, startLat: 1.3521, startLng: 103.8198, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.25, color: "#06B6D4" },
  { order: 10, startLat: 35.6762, startLng: 139.6503, endLat: 37.7749, endLng: -122.4194, arcAlt: 0.45, color: "#F59E0B" },
  { order: 11, startLat: -33.9249, startLng: 18.4241, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.38, color: "#10B981" },
  { order: 12, startLat: 30.0444, startLng: 31.2357, endLat: 25.2048, endLng: 55.2708, arcAlt: 0.15, color: "#EC4899" },
  { order: 13, startLat: 41.9028, startLng: 12.4964, endLat: 13.7563, endLng: 100.5018, arcAlt: 0.32, color: "#3B82F6" },
  { order: 14, startLat: 59.3293, startLng: 18.0686, endLat: -34.6037, endLng: -58.3816, arcAlt: 0.5, color: "#EF4444" },
];

onMounted(async () => {
  await globe.refresh();
  globe.startLiveUpdates();
});

onBeforeUnmount(() => {
  globe.stopLiveUpdates();
});

const liveArcs = computed(() => {
  const points = globe.visiblePoints.value;
  if (points.length < 2)
    return [];

  const arcs = [];
  const max = Math.min(points.length - 1, 16);
  for (let i = 0; i < max; i++) {
    const a = points[i];
    const b = points[i + 1];
    const distance = Math.hypot(a.lat - b.lat, a.long - b.long);
    arcs.push({
      order: i + 1,
      startLat: a.lat,
      startLng: a.long,
      endLat: b.lat,
      endLng: b.long,
      arcAlt: Math.min(0.6, Math.max(0.15, distance / 220)),
      color: palette[i % palette.length],
    });
  }
  return arcs;
});

const arcsData = computed(() => liveArcs.value.length > 0 ? liveArcs.value : fallbackArcs);

const livePointCount = computed(() => globe.visiblePoints.value.length);
const displayCount = computed(() => livePointCount.value || arcsData.value.length);

const globeConfig = computed(() => {
  const isDark = colorMode.value === "dark";
  return {
    pointSize: 2,
    showAtmosphere: true,
    atmosphereColor: isDark ? "#7c3aed" : "#38bdf8",
    atmosphereAltitude: 0.18,
    emissive: isDark ? "#020617" : "#f8fafc",
    emissiveIntensity: isDark ? 0.18 : 0.08,
    polygonColor: isDark ? "rgba(167, 139, 250, 0.62)" : "rgba(56, 189, 248, 0.55)",
    globeColor: isDark ? "#13042b" : "#dbeafe",
    ambientLight: isDark ? "#a5b4fc" : "#ffffff",
    directionalLeftLight: "#ffffff",
    directionalTopLight: "#ffffff",
    pointLight: "#ffffff",
    arcTime: 2800,
    arcLength: 0.9,
    rings: 12,
    shininess: 1.2,
    maxRings: 4,
    autoRotate: true,
    autoRotateSpeed: 0.6,
  };
});

const themeKey = computed(() => `${colorMode.value}-${arcsData.value.length}`);
</script>

<template>
  <div class="hero-globe">
    <!-- Glow halo behind the globe -->
    <div class="hero-globe__halo hero-globe__halo--outer" />
    <div class="hero-globe__halo hero-globe__halo--inner" />

    <!-- Subtle pulse rings for wow effect -->
    <div class="hero-globe__ring hero-globe__ring--a" />
    <div class="hero-globe__ring hero-globe__ring--b" />
    <div class="hero-globe__ring hero-globe__ring--c" />

    <div class="hero-globe__canvas">
      <ClientOnly>
        <GithubGlobe
          :key="themeKey"
          :data="arcsData"
          :globe-config="globeConfig"
          class="h-full w-full"
        />
      </ClientOnly>
    </div>

    <!-- Live counter pill -->
    <div class="hero-globe__pill" aria-live="polite">
      <span class="hero-globe__pill-dot" />
      <span class="hero-globe__pill-text">
        {{ displayCount }}
        <span class="hero-globe__pill-faint">путешественников онлайн</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.hero-globe {
  position: relative;
  width: 100%;
  height: 100%;
  isolation: isolate;
}

.hero-globe__canvas {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.hero-globe__halo {
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(60px);
  z-index: -1;
}

.hero-globe__halo--outer {
  width: 90%;
  height: 90%;
  background: radial-gradient(circle at 50% 55%, rgba(56, 189, 248, 0.45), transparent 65%);
  opacity: 0.7;
  animation: hero-halo-pulse 8s ease-in-out infinite;
}

.hero-globe__halo--inner {
  width: 60%;
  height: 60%;
  background: radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.35), transparent 70%);
  opacity: 0.55;
  animation: hero-halo-pulse 6s ease-in-out infinite reverse;
}

:global(html[data-theme="dark"]) .hero-globe__halo--outer {
  background: radial-gradient(circle at 50% 55%, rgba(124, 58, 237, 0.55), transparent 65%);
}

:global(html[data-theme="dark"]) .hero-globe__halo--inner {
  background: radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.35), transparent 70%);
}

.hero-globe__ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 9999px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}

:global(html[data-theme="dark"]) .hero-globe__ring {
  border-color: rgba(167, 139, 250, 0.3);
}

.hero-globe__ring--a {
  width: 72%;
  height: 72%;
  animation: hero-ring-pulse 4.2s ease-out infinite;
}

.hero-globe__ring--b {
  width: 82%;
  height: 82%;
  animation: hero-ring-pulse 4.2s ease-out infinite 1.4s;
}

.hero-globe__ring--c {
  width: 92%;
  height: 92%;
  animation: hero-ring-pulse 4.2s ease-out infinite 2.8s;
}

.hero-globe__pill {
  position: absolute;
  bottom: 4%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.95rem;
  border-radius: 9999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.85);
  color: #0f172a;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  transform: translateX(-50%);
  white-space: nowrap;
}

:global(html[data-theme="dark"]) .hero-globe__pill {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(10, 10, 18, 0.72);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
}

.hero-globe__pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: #10b981;
  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.18);
  animation: hero-pill-dot 1.8s ease-in-out infinite;
}

.hero-globe__pill-faint {
  opacity: 0.7;
  font-weight: 500;
}

@keyframes hero-halo-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.05);
  }
}

@keyframes hero-ring-pulse {
  0% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(0.85);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.15);
  }
}

@keyframes hero-pill-dot {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.18);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-globe__halo,
  .hero-globe__ring,
  .hero-globe__pill-dot {
    animation: none;
  }
}
</style>
