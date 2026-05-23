<script lang="ts" setup>
definePageMeta({ layout: false });

const authStore = useAuthStore();

const isSigningIn = ref(false);
const activeProvider = ref<"github" | "google" | null>(null);
const authError = ref("");

async function handleGithubSignIn() {
  await handleProviderSignIn("github");
}

async function handleGoogleSignIn() {
  await handleProviderSignIn("google");
}

async function handleProviderSignIn(provider: "github" | "google") {
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

watchEffect(() => {
  if (authStore.user) {
    navigateTo("/dashboard");
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-950 font-body selection:bg-brand-gold selection:text-brand-dark overflow-hidden dark:bg-[#000000] dark:text-white">
    <div v-if="authError" class="toast toast-top toast-center z-50">
      <div
        role="alert"
        aria-live="assertive"
        class="alert alert-error shadow-lg text-white"
      >
        <Icon name="tabler:alert-circle" class="text-xl" />
        <span>{{ authError }}</span>
      </div>
    </div>

    <div class="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-amber-50 z-0 dark:from-[#0d1117] dark:via-[#0e0f0f] dark:to-[#000000]" />

    <div
      class="absolute inset-0 z-0 opacity-20"
      style="background-image: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0); background-size: 40px 40px;"
    />

    <div class="absolute top-1/2 left-1/2 h-[80vw] max-h-[600px] w-[80vw] max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-blue-500/10 blur-[120px] pointer-events-none" />

    <div class="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
      <NuxtLink
        to="/"
        class="absolute left-4 top-4 flex items-center gap-2 text-gray-600 transition-colors duration-300 hover:text-gray-950 sm:left-8 sm:top-8 dark:text-gray-400 dark:hover:text-white"
      >
        <Icon name="tabler:arrow-left" class="text-xl" />
        <span class="text-sm font-medium">На главную</span>
      </NuxtLink>

      <div class="w-full max-w-md">
        <div class="text-center mb-12">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
            <Icon name="tabler:plane" class="text-4xl text-amber-400" />
          </div>
          <h1 class="font-bold tracking-tight text-3xl md:text-4xl text-gray-950 mb-4 dark:text-white">
            Добро пожаловать
          </h1>
          <p class="text-gray-600 text-lg dark:text-gray-400">
            Войдите, чтобы начать делиться своими путешествиями
          </p>
        </div>

        <div class="relative p-8 rounded-3xl bg-white/85 border border-gray-200 backdrop-blur-xl shadow-2xl dark:bg-gradient-to-b dark:from-gray-800/60 dark:to-gray-900/40 dark:border-gray-700/50">
          <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <div class="relative space-y-4">
            <button
              :disabled="isSigningIn"
              class="group w-full relative flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold bg-white text-gray-900 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              @click="handleGoogleSignIn"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span v-if="isSigningIn && activeProvider === 'google'" class="loading loading-spinner loading-md" />
              <Icon
                v-else
                name="tabler:brand-google"
                class="text-2xl relative z-10"
              />
              <span class="relative z-10">Продолжить с Google</span>
            </button>

            <button
              :disabled="isSigningIn"
              class="group w-full relative flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold bg-[#24292f] text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              @click="handleGithubSignIn"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-[#2d333b] to-[#24292f] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span v-if="isSigningIn && activeProvider === 'github'" class="loading loading-spinner loading-md" />
              <Icon
                v-else
                name="tabler:brand-github"
                class="text-2xl relative z-10"
              />
              <span class="relative z-10">Продолжить с GitHub</span>
            </button>
          </div>

          <div class="relative mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50">
            <p class="text-center text-sm text-gray-500 dark:text-gray-500">
              Регистрируясь, вы соглашаетесь с
              <a href="#" class="text-amber-400 hover:text-amber-300 transition-colors">условиями использования</a>
              и
              <a href="#" class="text-amber-400 hover:text-amber-300 transition-colors">политикой конфиденциальности</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-headline {
  font-family: "Dela Gothic One", cursive;
}
</style>
