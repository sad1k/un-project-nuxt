<script lang="ts" setup>
const authStore = useAuthStore();
</script>

<template>
  <div class="home-shell font-body selection:bg-brand-gold selection:text-brand-dark">
    <!-- Background ambience -->
    <div class="home-shell__bg" />
    <div class="home-shell__grid" />

    <!-- ============================================== -->
    <!-- DESKTOP HERO: text left, globe right (md+)     -->
    <!-- ============================================== -->
    <section class="hidden md:block relative w-full">
      <div class="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl grid-cols-12 items-center gap-8 px-8 py-16 lg:px-12">
        <!-- Left: Text content + CTAs -->
        <div class="col-span-12 lg:col-span-6 z-10">
          <span class="home-eyebrow">
            <span class="home-eyebrow__dot" />
            Live · {{ "путешествия по всему миру" }}
          </span>

          <h1 class="home-headline mt-6">
            Где мир
            <br>
            <span class="home-headline__accent">делится</span>
            <br>
            путешествиями
          </h1>

          <p class="home-lede mt-6 max-w-xl">
            Миллионы путешественников по всему миру делятся приключениями,
            открывают новые места и вдохновляют друг друга на WanderLog —
            крупнейшей платформе для логирования путешествий.
          </p>

          <div class="mt-10 flex flex-wrap items-center gap-3">
            <NuxtLink
              v-if="!authStore.user"
              to="/sign-in"
              class="home-cta-primary"
            >
              <span>Начать делиться</span>
              <Icon name="tabler:arrow-right" class="text-xl transition-transform group-hover:translate-x-0.5" />
            </NuxtLink>
            <NuxtLink
              v-else
              to="/feed"
              class="home-cta-primary"
            >
              <span>Перейти в ленту</span>
              <Icon name="tabler:arrow-right" class="text-xl transition-transform group-hover:translate-x-0.5" />
            </NuxtLink>

            <a href="#features" class="home-cta-secondary">
              Узнать больше
            </a>
          </div>

          <!-- Stats row -->
          <dl class="home-stats mt-12 grid max-w-lg grid-cols-3 gap-6">
            <div>
              <dt class="home-stats__value">
                73M+
              </dt>
              <dd class="home-stats__label">
                путешественников
              </dd>
            </div>
            <div>
              <dt class="home-stats__value">
                200M+
              </dt>
              <dd class="home-stats__label">
                публикаций
              </dd>
            </div>
            <div>
              <dt class="home-stats__value">
                190+
              </dt>
              <dd class="home-stats__label">
                стран
              </dd>
            </div>
          </dl>
        </div>

        <!-- Right: Realistic rotating globe -->
        <div class="col-span-12 lg:col-span-6 relative h-[420px] md:h-[560px] lg:h-[680px] xl:h-[760px]">
          <HomeHeroGlobe class="absolute inset-0" />
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- MOBILE HERO: CTAs top, globe peeks below       -->
    <!-- ============================================== -->
    <section class="md:hidden relative flex min-h-[100svh] flex-col overflow-hidden">
      <!-- Top content: auth call-to-action -->
      <div class="relative z-20 flex flex-col items-center px-6 pt-12 pb-8 text-center">
        <span class="home-eyebrow">
          <span class="home-eyebrow__dot" />
          Live путешествия
        </span>

        <h1 class="home-headline home-headline--mobile mt-5">
          Где мир
          <span class="home-headline__accent">делится</span>
          путешествиями
        </h1>

        <p class="home-lede home-lede--mobile mt-4 max-w-md">
          Делитесь моментами, открывайте новые места и находите единомышленников по всему миру.
        </p>

        <div class="mt-7 flex w-full max-w-sm flex-col gap-3">
          <NuxtLink
            v-if="!authStore.user"
            to="/sign-in"
            class="home-cta-primary w-full justify-center"
          >
            <span>Создать аккаунт</span>
            <Icon name="tabler:arrow-right" class="text-xl" />
          </NuxtLink>
          <NuxtLink
            v-else
            to="/feed"
            class="home-cta-primary w-full justify-center"
          >
            <span>Перейти в ленту</span>
            <Icon name="tabler:arrow-right" class="text-xl" />
          </NuxtLink>

          <NuxtLink
            v-if="!authStore.user"
            to="/sign-in"
            class="home-cta-secondary w-full justify-center"
          >
            Войти
          </NuxtLink>
          <a
            v-else
            href="#features"
            class="home-cta-secondary w-full justify-center"
          >
            Узнать больше
          </a>
        </div>
      </div>

      <!-- Bottom: a slice of the globe peeking up -->
      <div class="home-mobile-globe relative mt-auto h-[46svh] w-full overflow-hidden">
        <div class="home-mobile-globe__inner">
          <HomeHeroGlobe class="h-full w-full" />
        </div>
        <!-- Soft fade between text and globe top to create horizon -->
        <div class="home-mobile-globe__fade" />
      </div>
    </section>

    <!-- ============================================== -->
    <!-- Features Section                                -->
    <!-- ============================================== -->
    <section id="features" class="home-features relative py-20 md:py-24">
      <div class="container mx-auto px-6 lg:px-12">
        <div class="mb-12 text-center md:mb-16">
          <h2 class="home-section-title">
            Всё для ваших путешествий
          </h2>
          <p class="home-section-lede mt-3">
            Делитесь моментами, отмечайте места и находите единомышленников со всего мира
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          <div class="home-feature-card group">
            <div class="home-feature-card__icon home-feature-card__icon--amber">
              <Icon name="tabler:photo" class="text-3xl" />
            </div>
            <h3 class="home-feature-card__title">
              Публикуйте фото
            </h3>
            <p class="home-feature-card__text">
              Создавайте потрясающие галереи ваших приключений и делитесь ими с сообществом.
            </p>
          </div>

          <div class="home-feature-card group">
            <div class="home-feature-card__icon home-feature-card__icon--blue">
              <Icon name="tabler:map-pin" class="text-3xl" />
            </div>
            <h3 class="home-feature-card__title">
              Отмечайте места
            </h3>
            <p class="home-feature-card__text">
              Логируйте каждую страну и город на интерактивной карте.
            </p>
          </div>

          <div class="home-feature-card group">
            <div class="home-feature-card__icon home-feature-card__icon--violet">
              <Icon name="tabler:users" class="text-3xl" />
            </div>
            <h3 class="home-feature-card__title">
              Находите друзей
            </h3>
            <p class="home-feature-card__text">
              Подписывайтесь на путешественников со всего мира и вдохновляйтесь.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================== -->
    <!-- Final CTA                                       -->
    <!-- ============================================== -->
    <section class="home-cta-section relative py-20 md:py-24">
      <div class="container mx-auto px-6 text-center lg:px-12">
        <h2 class="home-section-title">
          Готовы начать?
        </h2>
        <p class="home-section-lede mt-3 mx-auto max-w-xl">
          Присоединяйтесь к глобальному сообществу путешественников
        </p>

        <NuxtLink
          v-if="!authStore.user"
          to="/sign-in"
          class="home-cta-primary mt-10 inline-flex"
        >
          <span>Создать аккаунт бесплатно</span>
          <Icon name="tabler:arrow-right" class="text-xl" />
        </NuxtLink>
        <NuxtLink
          v-else
          to="/feed"
          class="home-cta-primary mt-10 inline-flex"
        >
          <span>Перейти в ленту</span>
          <Icon name="tabler:arrow-right" class="text-xl" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: #0f172a;
  background: #f8fafc;
  transition:
    background-color 300ms ease,
    color 300ms ease;
}

:global(html[data-theme="dark"]) .home-shell {
  background: #050505;
  color: #ffffff;
}

.home-shell__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(56, 189, 248, 0.22), transparent 55%),
    radial-gradient(ellipse at 80% 20%, rgba(245, 158, 11, 0.18), transparent 55%),
    linear-gradient(180deg, #f0f9ff 0%, #f8fafc 50%, #fef3c7 100%);
}

:global(html[data-theme="dark"]) .home-shell__bg {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(124, 58, 237, 0.32), transparent 55%),
    radial-gradient(ellipse at 80% 20%, rgba(236, 72, 153, 0.18), transparent 55%),
    linear-gradient(180deg, #0d0717 0%, #050505 60%, #050505 100%);
}

.home-shell__grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.18;
  background-image: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.4) 1px, transparent 0);
  background-size: 40px 40px;
  pointer-events: none;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.35) 70%, transparent 100%);
}

:global(html[data-theme="dark"]) .home-shell__grid {
  background-image: radial-gradient(circle at 1px 1px, rgba(167, 139, 250, 0.35) 1px, transparent 0);
  opacity: 0.22;
}

/* Eyebrow chip */
.home-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(255, 255, 255, 0.7);
  color: rgba(15, 23, 42, 0.78);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
}

:global(html[data-theme="dark"]) .home-eyebrow {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.82);
}

.home-eyebrow__dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.22);
  animation: home-dot-pulse 1.8s ease-in-out infinite;
}

/* Headline */
.home-headline {
  font-family: "Dela Gothic One", cursive;
  font-size: clamp(2.5rem, 5.5vw, 5rem);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.home-headline--mobile {
  font-size: clamp(2.1rem, 9vw, 2.9rem);
  line-height: 1.1;
}

.home-headline__accent {
  background: linear-gradient(120deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* Lede paragraph */
.home-lede {
  font-size: clamp(1rem, 1.1vw, 1.18rem);
  line-height: 1.6;
  color: rgba(15, 23, 42, 0.72);
}

.home-lede--mobile {
  font-size: 0.98rem;
  line-height: 1.55;
}

:global(html[data-theme="dark"]) .home-lede {
  color: rgba(255, 255, 255, 0.7);
}

/* Primary CTA */
.home-cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.95rem 1.5rem;
  border-radius: 0.85rem;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.005em;
  background: linear-gradient(120deg, #f59e0b 0%, #f97316 50%, #ec4899 100%);
  color: #1a0a00;
  box-shadow: 0 12px 28px rgba(245, 158, 11, 0.28);
  transition:
    transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 200ms ease;
  text-decoration: none;
  white-space: nowrap;
}

.home-cta-primary:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 18px 36px rgba(245, 158, 11, 0.4);
}

.home-cta-primary:active {
  transform: translateY(0) scale(0.98);
}

.home-cta-primary:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 3px;
}

/* Secondary CTA */
.home-cta-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.95rem 1.5rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: rgba(255, 255, 255, 0.7);
  color: rgba(15, 23, 42, 0.88);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  backdrop-filter: blur(8px);
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    transform 180ms ease;
}

.home-cta-secondary:hover {
  border-color: rgba(15, 23, 42, 0.32);
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-1px);
}

.home-cta-secondary:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 3px;
}

:global(html[data-theme="dark"]) .home-cta-secondary {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
}

:global(html[data-theme="dark"]) .home-cta-secondary:hover {
  border-color: rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.1);
}

/* Stats */
.home-stats__value {
  font-family: "Dela Gothic One", cursive;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: rgba(15, 23, 42, 0.95);
}

:global(html[data-theme="dark"]) .home-stats__value {
  color: rgba(255, 255, 255, 0.96);
}

.home-stats__label {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: rgba(15, 23, 42, 0.58);
  letter-spacing: 0.01em;
}

:global(html[data-theme="dark"]) .home-stats__label {
  color: rgba(255, 255, 255, 0.5);
}

/* Mobile globe peeking */
.home-mobile-globe {
  position: relative;
}

.home-mobile-globe__inner {
  position: absolute;
  left: 50%;
  top: 0;
  width: 220vw;
  max-width: 900px;
  aspect-ratio: 1 / 1;
  transform: translateX(-50%);
}

.home-mobile-globe__fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, var(--home-fade-color, #f8fafc) 0%, transparent 18%, transparent 100%);
}

:global(html[data-theme="dark"]) .home-mobile-globe__fade {
  background: linear-gradient(180deg, #050505 0%, transparent 18%, transparent 100%);
}

/* Sections */
.home-features {
  background: #ffffff;
  transition: background-color 300ms ease;
}

:global(html[data-theme="dark"]) .home-features {
  background: #0a0a0f;
}

.home-cta-section {
  background: linear-gradient(180deg, #fef3c7 0%, #fef9e7 100%);
}

:global(html[data-theme="dark"]) .home-cta-section {
  background: linear-gradient(180deg, #0a0a0f 0%, #050505 100%);
}

.home-section-title {
  font-family: "Dela Gothic One", cursive;
  font-weight: 400;
  font-size: clamp(1.85rem, 3.5vw, 2.8rem);
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: rgba(15, 23, 42, 0.98);
}

:global(html[data-theme="dark"]) .home-section-title {
  color: #ffffff;
}

.home-section-lede {
  font-size: 1rem;
  color: rgba(15, 23, 42, 0.64);
  line-height: 1.6;
}

:global(html[data-theme="dark"]) .home-section-lede {
  color: rgba(255, 255, 255, 0.6);
}

/* Feature cards */
.home-feature-card {
  position: relative;
  padding: 1.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #ffffff;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.06);
  transition:
    transform 200ms ease,
    border-color 200ms ease,
    box-shadow 200ms ease;
}

.home-feature-card:hover {
  transform: translateY(-3px);
  border-color: rgba(245, 158, 11, 0.32);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.1);
}

:global(html[data-theme="dark"]) .home-feature-card {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.4);
}

:global(html[data-theme="dark"]) .home-feature-card:hover {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(255, 255, 255, 0.06);
}

.home-feature-card__icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  margin-bottom: 1.25rem;
  transition: transform 200ms ease;
}

.home-feature-card:hover .home-feature-card__icon {
  transform: scale(1.08);
}

.home-feature-card__icon--amber {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(249, 115, 22, 0.18));
  color: #d97706;
}

.home-feature-card__icon--blue {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(99, 102, 241, 0.18));
  color: #2563eb;
}

.home-feature-card__icon--violet {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(236, 72, 153, 0.18));
  color: #9333ea;
}

:global(html[data-theme="dark"]) .home-feature-card__icon--amber {
  color: #fbbf24;
}

:global(html[data-theme="dark"]) .home-feature-card__icon--blue {
  color: #60a5fa;
}

:global(html[data-theme="dark"]) .home-feature-card__icon--violet {
  color: #c084fc;
}

.home-feature-card__title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.5rem;
  color: rgba(15, 23, 42, 0.95);
}

:global(html[data-theme="dark"]) .home-feature-card__title {
  color: #ffffff;
}

.home-feature-card__text {
  font-size: 0.92rem;
  line-height: 1.55;
  color: rgba(15, 23, 42, 0.62);
}

:global(html[data-theme="dark"]) .home-feature-card__text {
  color: rgba(255, 255, 255, 0.58);
}

@keyframes home-dot-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.22);
  }
  50% {
    opacity: 0.85;
    box-shadow: 0 0 0 7px rgba(16, 185, 129, 0.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-eyebrow__dot {
    animation: none;
  }
}
</style>
