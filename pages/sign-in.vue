<script lang="ts" setup>
const authStore = useAuthStore();

const isSigningIn = ref(false);
const activeProvider = ref<"github" | "google" | null>(null);

async function handleGithubSignIn() {
  isSigningIn.value = true;
  activeProvider.value = "github";
  await authStore.signInWithGithub();
}

async function handleGoogleSignIn() {
  isSigningIn.value = true;
  activeProvider.value = "google";
  await authStore.signInWithGoogle();
}

watchEffect(() => {
  if (authStore.user) {
    navigateTo("/dashboard");
  }
});
</script>

<template>
  <div class="min-h-screen bg-[#000000] text-white font-body selection:bg-brand-gold selection:text-brand-dark overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#0e0f0f] to-[#000000] z-0" />

    <div
      class="absolute inset-0 z-0 opacity-20"
      style="background-image: radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0); background-size: 40px 40px;"
    />

    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

    <div class="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
      <NuxtLink
        to="/"
        class="absolute top-8 left-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300"
      >
        <Icon name="tabler:arrow-left" class="text-xl" />
        <span class="text-sm font-medium">На главную</span>
      </NuxtLink>

      <div class="w-full max-w-md">
        <div class="text-center mb-12">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
            <Icon name="tabler:plane" class="text-4xl text-amber-400" />
          </div>
          <h1 class="font-headline text-3xl md:text-4xl text-white mb-4">
            Добро пожаловать
          </h1>
          <p class="text-gray-400 text-lg">
            Войдите, чтобы начать делиться своими путешествиями
          </p>
        </div>

        <div class="relative p-8 rounded-3xl bg-gradient-to-b from-gray-800/60 to-gray-900/40 border border-gray-700/50 backdrop-blur-xl shadow-2xl">
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

          <div class="relative mt-8 pt-6 border-t border-gray-700/50">
            <p class="text-center text-sm text-gray-500">
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
