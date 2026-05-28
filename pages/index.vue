<script lang="ts" setup>
// Lazy chunk: keeps mapbox-gl out of the index page's Vite compile graph.
// The globe is decorative + client-only, so paying its cost on demand is fine.
const FeedGlobe = defineAsyncComponent(() => import("~/components/feed/feed-globe.client.vue"));

const authStore = useAuthStore();

const isSigningIn = ref(false);
const activeProvider = ref<"github" | "google" | null>(null);
const authError = ref("");

async function handleProviderSignIn(provider: "github" | "google") {
  if (isSigningIn.value)
    return;
  isSigningIn.value = true;
  activeProvider.value = provider;
  authError.value = "";

  try {
    if (provider === "github")
      await authStore.signInWithGithub();
    else
      await authStore.signInWithGoogle();
  }
  catch {
    authError.value = "Не удалось войти. Проверьте подключение и попробуйте ещё раз.";
  }
  finally {
    isSigningIn.value = false;
    activeProvider.value = null;
  }
}
</script>

<template>
  <div class="cosmos font-body selection:bg-white selection:text-black">
    <!-- Cosmic background layers -->
    <div class="cosmos__sky" aria-hidden="true" />
    <div class="cosmos__stars cosmos__stars--far" aria-hidden="true" />
    <div class="cosmos__stars cosmos__stars--near" aria-hidden="true" />
    <div class="cosmos__nebula cosmos__nebula--violet" aria-hidden="true" />
    <div class="cosmos__nebula cosmos__nebula--cyan" aria-hidden="true" />
    <div class="cosmos__grid" aria-hidden="true" />

    <!-- Toast (auth error) -->
    <div
      v-if="authError"
      class="cosmos__toast"
      role="alert"
      aria-live="assertive"
    >
      <Icon name="tabler:alert-circle" class="text-lg" />
      <span>{{ authError }}</span>
    </div>

    <!-- Globe: single mapbox instance. Position/size swap between mobile (peek
         from the bottom) and desktop (giant arc on the right) via media queries. -->
    <div class="cosmos__globe" aria-hidden="true">
      <div class="cosmos__globe-canvas">
        <ClientOnly>
          <FeedGlobe
            :realistic="true"
            :hide-chrome="true"
            :zoom="2.6"
            :spin-speed="0.02"
          />
        </ClientOnly>
      </div>
      <div class="cosmos__globe-fade" />
    </div>

    <!-- Auth shell: stacked-centered on mobile, left column on desktop -->
    <section class="cosmos__shell">
      <div class="cosmos__auth">
        <div class="cosmos__brand">
          <span class="cosmos__brand-dot" />
          <span class="cosmos__brand-text">WanderLog</span>
        </div>

        <h1 class="cosmos__headline">
          В курсе<br>
          <span class="cosmos__headline-accent">путешествий</span>
          <br>
          всего мира.
        </h1>

        <p class="cosmos__sub">
          Присоединяйтесь сегодня.
        </p>

        <div class="cosmos__buttons">
          <button
            :disabled="isSigningIn"
            class="cosmos__btn cosmos__btn--light"
            @click="handleProviderSignIn('google')"
          >
            <span v-if="isSigningIn && activeProvider === 'google'" class="cosmos__spinner" />
            <Icon
              v-else
              name="logos:google-icon"
              class="text-xl"
            />
            <span>Продолжить с Google</span>
          </button>

          <button
            :disabled="isSigningIn"
            class="cosmos__btn cosmos__btn--dark"
            @click="handleProviderSignIn('github')"
          >
            <span v-if="isSigningIn && activeProvider === 'github'" class="cosmos__spinner cosmos__spinner--light" />
            <Icon
              v-else
              name="tabler:brand-github"
              class="text-xl"
            />
            <span>Продолжить с GitHub</span>
          </button>

          <div class="cosmos__divider" role="separator">
            <span class="cosmos__divider-line" />
            <span class="cosmos__divider-text">или</span>
            <span class="cosmos__divider-line" />
          </div>

          <p class="cosmos__small">
            Уже есть аккаунт?
            <NuxtLink to="/sign-in" class="cosmos__link">
              Войти
            </NuxtLink>
          </p>
        </div>

        <p class="cosmos__legal">
          Продолжая, вы соглашаетесь с
          <a href="#" class="cosmos__legal-link">Условиями использования</a>,
          <a href="#" class="cosmos__legal-link">Политикой конфиденциальности</a>
          и
          <a href="#" class="cosmos__legal-link">Использованием cookie</a>.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* =================================
   Cosmic shell — deep-space backdrop
   ================================= */
.cosmos {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  color: #f5f5f7;
  background: #05060a;
  isolation: isolate;
}

.cosmos__sky {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 70% 50%, rgba(124, 58, 237, 0.18), transparent 70%),
    radial-gradient(ellipse 70% 60% at 30% 100%, rgba(14, 165, 233, 0.14), transparent 70%),
    radial-gradient(ellipse 50% 40% at 50% 0%, rgba(244, 114, 182, 0.06), transparent 70%),
    linear-gradient(180deg, #05060a 0%, #07081a 60%, #05060a 100%);
}

.cosmos__stars {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-repeat: repeat;
}

.cosmos__stars--far {
  background-image:
    radial-gradient(1px 1px at 20px 30px, rgba(255, 255, 255, 0.55), transparent),
    radial-gradient(1px 1px at 60px 120px, rgba(255, 255, 255, 0.38), transparent),
    radial-gradient(1px 1px at 130px 80px, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 200px 200px, rgba(255, 255, 255, 0.3), transparent),
    radial-gradient(1px 1px at 280px 60px, rgba(255, 255, 255, 0.45), transparent),
    radial-gradient(1px 1px at 320px 240px, rgba(255, 255, 255, 0.4), transparent);
  background-size: 380px 280px;
  opacity: 0.7;
  animation: cosmos-twinkle 6s ease-in-out infinite;
}

.cosmos__stars--near {
  background-image:
    radial-gradient(1.5px 1.5px at 40px 90px, rgba(255, 255, 255, 0.85), transparent),
    radial-gradient(1.5px 1.5px at 180px 40px, rgba(190, 220, 255, 0.7), transparent),
    radial-gradient(2px 2px at 240px 180px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1.5px 1.5px at 350px 110px, rgba(220, 200, 255, 0.7), transparent);
  background-size: 520px 360px;
  opacity: 0.9;
  animation: cosmos-twinkle 4s ease-in-out infinite reverse;
}

.cosmos__nebula {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  border-radius: 9999px;
  filter: blur(120px);
}

.cosmos__nebula--violet {
  width: 38vw;
  height: 38vw;
  top: -10vw;
  right: 5vw;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.35), transparent 70%);
}

.cosmos__nebula--cyan {
  width: 32vw;
  height: 32vw;
  bottom: -10vw;
  left: -5vw;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.22), transparent 70%);
}

.cosmos__grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.18;
  background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.18) 1px, transparent 0);
  background-size: 36px 36px;
  mask-image: radial-gradient(ellipse 70% 60% at 30% 50%, rgba(0, 0, 0, 1) 0%, transparent 70%);
}

/* Toast */
.cosmos__toast {
  position: fixed;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.95);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

/* =================================
   Globe layer — single instance, repositioned per viewport
   Mobile: peeks from the bottom; desktop: giant arc on the right edge.
   ================================= */
.cosmos__globe {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60svh;
  min-height: 420px;
}

.cosmos__globe-canvas {
  position: absolute;
  top: 0;
  left: 50%;
  width: 200vw;
  max-width: 760px;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, 8%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, transparent 10%, rgba(0, 0, 0, 0.55) 22%, #000 38%);
  mask-image: linear-gradient(180deg, transparent 0%, transparent 10%, rgba(0, 0, 0, 0.55) 22%, #000 38%);
}

.cosmos__globe-fade {
  display: none;
}

@media (min-width: 768px) {
  .cosmos__globe {
    /* Spans the full viewport so the oversized canvas can extend past every edge */
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .cosmos__globe-canvas {
    /* Oversized sphere whose left silhouette traces a soft arc roughly down
       the middle-right of the viewport. Oversized canvas → no glow cutoff. */
    top: 50%;
    left: auto;
    right: -110vh;
    width: 250vh;
    height: 210vh;
    max-width: none;
    aspect-ratio: auto;
    transform: translateY(-50%);
    -webkit-mask-image: none;
    mask-image: none;
  }

  .cosmos__globe-fade {
    display: none;
  }
}

@media (min-width: 1280px) {
  .cosmos__globe {
    /* Spans the full viewport so the oversized canvas can extend past every edge */
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .cosmos__globe-canvas {
    /* Oversized sphere whose left silhouette traces a soft arc roughly down
       the middle-right of the viewport. Oversized canvas → no glow cutoff. */
    top: 50%;
    left: auto;
    right: -90vh;
    width: 250vh;
    height: 210vh;
    max-width: none;
    aspect-ratio: auto;
    transform: translateY(-50%);
    -webkit-mask-image: none;
    mask-image: none;
  }

  .cosmos__globe-fade {
    display: none;
  }
}

/* =================================
   Shell + auth
   Mobile: stacked, centered, padding-bottom leaves room for the globe peek.
   Desktop: column floats on the left, vertically centered.
   ================================= */
.cosmos__shell {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100svh;
  padding: 1.5rem 1.5rem 38svh;
  text-align: center;
}

.cosmos__auth {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 360px;
}

@media (min-width: 768px) {
  .cosmos__shell {
    align-items: flex-start;
    justify-content: center;
    text-align: left;
    padding: 4rem 3rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .cosmos__auth {
    align-items: flex-start;
    gap: 1.5rem;
    max-width: 460px;
  }
}

/* Brand */
.cosmos__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.78);
}

.cosmos__brand-dot {
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #f59e0b, #ec4899);
  box-shadow: 0 0 14px rgba(245, 158, 11, 0.7);
}

.cosmos__brand-text {
  font-family: "Dela Gothic One", cursive;
  letter-spacing: 0.02em;
}

/* Headline */
.cosmos__headline {
  font-family: "Dela Gothic One", cursive;
  font-weight: 400;
  font-size: clamp(2rem, 8.5vw, 2.8rem);
  line-height: 1.08;
  letter-spacing: -0.025em;
  color: #ffffff;
  margin: 0;
}

@media (min-width: 768px) {
  .cosmos__headline {
    font-size: clamp(2.5rem, 4.6vw, 4.4rem);
    line-height: 1.02;
  }
}

.cosmos__headline-accent {
  background: linear-gradient(120deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

/* Sub */
.cosmos__sub {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
  margin: 0;
  max-width: 22rem;
}

@media (min-width: 768px) {
  .cosmos__sub {
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.3;
    color: #ffffff;
    max-width: none;
  }
}

/* Buttons */
.cosmos__buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 360px;
}

@media (min-width: 768px) {
  .cosmos__buttons {
    max-width: 320px;
  }
}

.cosmos__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  height: 44px;
  padding: 0 1rem;
  border-radius: 9999px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.005em;
  border: none;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease;
}

.cosmos__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cosmos__btn:not(:disabled):active {
  transform: scale(0.97);
}

.cosmos__btn--light {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 8px 24px rgba(255, 255, 255, 0.08);
}

.cosmos__btn--light:not(:disabled):hover {
  background: #e7e7ea;
  box-shadow: 0 10px 28px rgba(255, 255, 255, 0.12);
}

.cosmos__btn--dark {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
}

.cosmos__btn--dark:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.22);
}

.cosmos__btn:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 3px;
}

/* Spinner */
.cosmos__spinner {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  border: 2px solid rgba(15, 23, 42, 0.2);
  border-top-color: rgba(15, 23, 42, 0.85);
  animation: cosmos-spin 0.7s linear infinite;
}

.cosmos__spinner--light {
  border-color: rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 255, 255, 0.9);
}

/* Divider */
.cosmos__divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0 0.25rem;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cosmos__divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}

/* Links */
.cosmos__small {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.72);
  margin: 0;
}

.cosmos__link {
  color: #38bdf8;
  font-weight: 600;
  text-decoration: none;
  transition: color 160ms ease;
}

.cosmos__link:hover {
  color: #7dd3fc;
}

.cosmos__legal {
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.4);
  max-width: 320px;
  margin: 0;
}

.cosmos__legal-link {
  color: #38bdf8;
  text-decoration: none;
}

.cosmos__legal-link:hover {
  color: #7dd3fc;
}

/* =================================
   Animations
   ================================= */
@keyframes cosmos-twinkle {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 0.95;
  }
}

@keyframes cosmos-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cosmos__stars,
  .cosmos__spinner {
    animation: none;
  }
}
</style>
