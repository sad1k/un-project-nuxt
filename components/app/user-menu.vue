<script lang="ts" setup>
const authStore = useAuthStore();

const menuRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const isAdmin = computed(() => authStore.user?.role === "admin");

const userInitials = computed(() => {
  const name = authStore.user?.name?.trim();
  if (!name)
    return "WL";

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
});

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function closeMenu() {
  isOpen.value = false;
}

function handleDocumentClick(event: MouseEvent) {
  if (!menuRef.value?.contains(event.target as Node))
    closeMenu();
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      v-if="!authStore.loading && authStore.user"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      class="app-chrome-control group flex h-10 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 shadow-2xl backdrop-blur-xl transition-all duration-300"
      type="button"
      @click.stop="toggleMenu"
    >
      <span class="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-sangria to-brand-gold text-[10px] font-bold text-white ring-1 ring-white/15">
        <img
          v-if="authStore.user.image"
          :alt="authStore.user.name || 'Аватар пользователя'"
          class="h-full w-full object-cover"
          :src="authStore.user.image"
        >
        <span v-else>{{ userInitials }}</span>
      </span>
      <span class="app-chrome-muted hidden max-w-28 truncate text-xs sm:block">
        {{ authStore.user.name || "Профиль" }}
      </span>
      <Icon
        class="app-chrome-faint transition duration-300 group-hover:translate-y-0.5 group-hover:text-brand-gold"
        name="tabler:chevron-down"
        size="14"
      />
    </button>

    <button
      v-else
      :disabled="authStore.loading"
      class="group flex h-10 items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold px-4 text-xs font-bold text-brand-dark shadow-2xl shadow-brand-gold/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-60"
      type="button"
      @click="authStore.signIn"
    >
      <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
      <Icon
        v-else
        class="transition duration-300 group-hover:rotate-6"
        name="tabler:brand-github"
        size="17"
      />
      <span class="hidden sm:inline">Войти</span>
    </button>

    <Transition name="glass-menu">
      <div
        v-if="isOpen && authStore.user"
        class="app-chrome-strong absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border p-2 backdrop-blur-2xl"
        role="menu"
      >
        <div class="flex items-center gap-3 border-b border-[var(--app-chrome-border)] px-3 py-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-sangria to-brand-gold text-xs font-bold text-white ring-1 ring-white/15">
            <img
              v-if="authStore.user.image"
              :alt="authStore.user.name || 'Аватар пользователя'"
              class="h-full w-full object-cover"
              :src="authStore.user.image"
            >
            <span v-else>{{ userInitials }}</span>
          </span>
          <div class="min-w-0">
            <p class="app-chrome-text truncate text-sm font-semibold">
              {{ authStore.user.name || "Путешественник" }}
            </p>
            <p class="app-chrome-faint truncate text-xs">
              {{ authStore.user.email || "Профиль WanderLog" }}
            </p>
          </div>
        </div>

        <NuxtLink
          class="app-chrome-muted mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]"
          role="menuitem"
          to="/dashboard"
          @click="closeMenu"
        >
          <Icon name="tabler:map" size="18" />
          Мои места
        </NuxtLink>
        <NuxtLink
          class="app-chrome-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]"
          role="menuitem"
          to="/explore"
          @click="closeMenu"
        >
          <Icon name="tabler:compass" size="18" />
          Исследуй
        </NuxtLink>
        <NuxtLink
          class="app-chrome-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]"
          role="menuitem"
          to="/feed"
          @click="closeMenu"
        >
          <Icon name="tabler:world" size="18" />
          Лента
        </NuxtLink>
        <NuxtLink
          v-if="isAdmin"
          class="app-chrome-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]"
          role="menuitem"
          to="/admin/route-generations"
          @click="closeMenu"
        >
          <Icon name="tabler:activity-heartbeat" size="18" />
          Мониторинг маршрутов
        </NuxtLink>
        <NuxtLink
          class="app-chrome-muted mt-2 flex items-center gap-3 rounded-xl border border-[var(--app-chrome-border)] px-3 py-2.5 text-sm transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-200"
          role="menuitem"
          to="/sign-out"
          @click="closeMenu"
        >
          <Icon name="tabler:logout-2" size="18" />
          Выйти
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.glass-menu-enter-active,
.glass-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.glass-menu-enter-from,
.glass-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
