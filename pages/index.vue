<script lang="ts" setup>
const authStore = useAuthStore();
const colorMode = useColorMode();

const globeArcs = [
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

const globeConfig = computed(() => {
  const isDark = colorMode.value === "dark";
  return {
    pointSize: 2,
    showAtmosphere: true,
    atmosphereColor: isDark ? "#571cb8" : "#3B82F6",
    atmosphereAltitude: 0.15,
    emissive: isDark ? "#000000" : "#ffffff",
    emissiveIntensity: 0.15,
    polygonColor: isDark ? "rgba(99, 102, 241, 0.6)" : "rgba(59, 130, 246, 0.5)",
    globeColor: isDark ? "#1d072e" : "#e0f2fe",
    ambientLight: isDark ? "#94a3b8" : "#ffffff",
    directionalLeftLight: "#ffffff",
    directionalTopLight: "#ffffff",
    pointLight: "#ffffff",
    arcTime: 3000,
    arcLength: 0.85,
    rings: 10,
    shininess: 1,
    maxRings: 4,
    autoRotate: false,
    autoRotateSpeed: 0.005,
  };
});

const rippleCircleProps = computed(() => ({
  size: 400,
  opacity: colorMode.value === "dark" ? 0.24 : 0.1,
}));
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-[#000000] text-gray-900 dark:text-white font-body selection:bg-brand-gold selection:text-brand-dark overflow-hidden transition-colors duration-300">
    <!-- Hero Section - GitHub Style -->
    <section class="relative w-full min-h-screen">
      <!-- Background gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-gray-50 dark:from-[#0d1117] dark:via-[#0e0f0f] dark:to-[#000000] z-0 transition-colors duration-300" />

      <!-- Subtle grid pattern -->
      <div
        class="absolute inset-0 z-0 opacity-20 dark:opacity-20"
        style="background-image: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0); background-size: 40px 40px;"
      />

      <!-- Main content container -->
      <div class="relative container mx-auto px-6 lg:px-12  min-h-screen flex items-center">
        <!-- Globe - Centered Background -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <!-- Glow effect behind globe -->

          <div class="absolute w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[150px]" />
          <div
            class="absolute z-0 flex h-[1000px] w-full flex-col items-center justify-center overflow-hidden lg:w-full md:w-full"
          >
            <Ripple circle-class="border-[hsl(var(--primary))] rounded-full" v-bind="rippleCircleProps" />
          </div>
          <div class="relative z-10">
            <ClientOnly>
              <GithubGlobe
                :key="colorMode.value"
                :data="globeArcs"
                :globe-config="globeConfig"
                class="w-[500px] h-[500px] md:w-[700px] md:h-[700px] lg:w-[1000px] lg:h-[1000px] opacity-80"
              />
            </ClientOnly>
          </div>
        </div>

        <!-- Text content - Overlaid -->
        <div class="relative z-20 w-full text-center">
          <h1 class="font-headline text-5xl md:text-6xl lg:text-8xl leading-tight tracking-tight text-gray-900 dark:text-white mb-6">
            Где мир
            <br>
            <span class="bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
              делится
            </span>
            <br>
            путешествиями
          </h1>

          <p class="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Миллионы путешественников по всему миру делятся своими приключениями,
            открывают новые места и вдохновляют друг друга на WanderLog —
            крупнейшей платформе для логирования путешествий.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <NuxtLink
              v-if="!authStore.user"
              to="/sign-in"
              class="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-black bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
            >
              <span class="relative z-10">Начать делиться →</span>
              <div class="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </NuxtLink>
            <NuxtLink
              v-else
              to="/feed"
              class="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-black bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30"
            >
              <span class="relative z-10">Перейти в ленту →</span>
              <div class="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </NuxtLink>

            <a
              href="#features"
              class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl hover:border-gray-400 dark:hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-300"
            >
              Узнать больше
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="relative py-24 bg-gray-50 dark:bg-[#0d1117] transition-colors duration-300">
      <div class="container mx-auto px-6 lg:px-12">
        <div class="text-center mb-16">
          <h2 class="font-headline text-4xl md:text-5xl text-gray-900 dark:text-white mb-4">
            Всё для ваших путешествий
          </h2>
          <p class="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Делитесь моментами, отмечайте места и находите единомышленников со всего мира
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Feature 1 -->
          <div class="group relative p-8 rounded-2xl bg-gradient-to-b from-white to-transparent dark:from-gray-800/50 dark:to-transparent border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 shadow-sm dark:shadow-none">
            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Icon name="tabler:photo" class="text-3xl text-amber-500 dark:text-amber-400" />
            </div>
            <h3 class="font-headline text-xl text-gray-900 dark:text-white mb-3">
              Публикуйте фото
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Создавайте потрясающие галереи ваших приключений и делитесь ими с сообществом.
            </p>
          </div>

          <!-- Feature 2 -->
          <div class="group relative p-8 rounded-2xl bg-gradient-to-b from-white to-transparent dark:from-gray-800/50 dark:to-transparent border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 shadow-sm dark:shadow-none">
            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Icon name="tabler:map-pin" class="text-3xl text-blue-500 dark:text-blue-400" />
            </div>
            <h3 class="font-headline text-xl text-gray-900 dark:text-white mb-3">
              Отмечайте места
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Логируйте каждую страну и город, которые вы посетили, на интерактивной карте.
            </p>
          </div>

          <!-- Feature 3 -->
          <div class="group relative p-8 rounded-2xl bg-gradient-to-b from-white to-transparent dark:from-gray-800/50 dark:to-transparent border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 shadow-sm dark:shadow-none">
            <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Icon name="tabler:users" class="text-3xl text-purple-500 dark:text-purple-400" />
            </div>
            <h3 class="font-headline text-xl text-gray-900 dark:text-white mb-3">
              Находите друзей
            </h3>
            <p class="text-gray-600 dark:text-gray-400 leading-relaxed">
              Подписывайтесь на путешественников со всего мира и вдохновляйтесь их историями.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="relative py-24 bg-gradient-to-t from-gray-100 to-gray-50 dark:from-[#161b22] dark:to-[#0d1117] transition-colors duration-300">
      <div class="container mx-auto px-6 lg:px-12 text-center">
        <h2 class="font-headline text-4xl md:text-5xl text-gray-900 dark:text-white mb-6">
          Готовы начать?
        </h2>
        <p class="text-gray-600 dark:text-gray-400 text-lg max-w-xl mx-auto mb-10">
          Присоединяйтесь к глобальному сообществу путешественников уже сегодня
        </p>

        <NuxtLink
          v-if="!authStore.user"
          to="/sign-in"
          class="inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-black bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300"
        >
          Создать аккаунт бесплатно
        </NuxtLink>
        <NuxtLink
          v-else
          to="/feed"
          class="inline-flex items-center justify-center px-10 py-5 text-xl font-bold text-black bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300"
        >
          Перейти в ленту
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.font-headline {
  font-family: "Dela Gothic One", cursive;
}
</style>
