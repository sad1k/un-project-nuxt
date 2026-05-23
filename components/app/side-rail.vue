<script lang="ts" setup>
type RailMode = "overlay" | "inline";

const props = withDefaults(defineProps<{
  mode?: RailMode;
}>(), {
  mode: "inline",
});

const route = useRoute();
const authStore = useAuthStore();
const isExpanded = ref(false);
const isDrawerOpen = ref(false);
const isAdmin = computed(() => authStore.user?.role === "admin");
const showLabels = computed(() => isExpanded.value || isDrawerOpen.value);

const primaryActions = [
  { icon: "tabler:list", label: "Лента", to: "/feed" },
  { icon: "tabler:compass", label: "Исследуй", to: "/explore" },
  { icon: "tabler:map", label: "Мои места", to: "/dashboard" },
];

const secondaryActions = computed(() => [
  { icon: "tabler:camera-plus", label: "Быстрое фото", to: "/dashboard/place-photo/new" },
  { icon: "tabler:circle-plus-filled", label: "Добавить место", to: "/dashboard/add" },
  { icon: "tabler:send", label: "Опубликовать", to: "/dashboard/publish" },
  { icon: "tabler:bookmark", label: "Сохранённые", to: "/dashboard" },
  ...(isAdmin.value
    ? [{ icon: "tabler:activity-heartbeat", label: "Мониторинг маршрутов", to: "/admin/route-generations" }]
    : []),
  authStore.user
    ? { icon: "tabler:logout-2", label: "Выйти", to: "/sign-out" }
    : { icon: "tabler:login", label: "Войти", to: "/sign-in" },
]);

const railClass = computed(() => props.mode === "overlay"
  ? "fixed bottom-0 left-0 top-0 z-50 md:absolute md:z-40"
  : "fixed bottom-0 left-0 top-0 z-50 md:sticky md:top-16 md:z-30 md:h-[calc(100vh-4rem)]");

function isActive(path: string) {
  if (path === "/dashboard")
    return route.path === "/dashboard" || route.path.startsWith("/dashboard/location");

  return route.path === path;
}

function toggleExpanded() {
  if (isDrawerOpen.value) {
    closeDrawer();
    return;
  }

  isExpanded.value = !isExpanded.value;
}

function openDrawer() {
  isDrawerOpen.value = true;
  isExpanded.value = true;
}

function closeDrawer() {
  isDrawerOpen.value = false;
  isExpanded.value = false;
}
</script>

<template>
  <div class="hidden md:block">
    <button
      v-if="!isDrawerOpen"
      aria-label="Открыть боковую панель"
      class="app-chrome-control fixed left-3 top-20 z-50 flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur-xl transition hover:text-brand-gold md:hidden"
      type="button"
      @click="openDrawer"
    >
      <Icon name="tabler:menu-2" size="18" />
    </button>

    <button
      v-if="isDrawerOpen"
      aria-label="Закрыть боковую панель"
      class="fixed inset-0 z-40 bg-black/35 md:hidden"
      type="button"
      @click="closeDrawer"
    />

    <aside
      class="app-chrome flex flex-col justify-between border-r py-4 shadow-2xl backdrop-blur-xl transition-all duration-300"
      :class="[
        railClass,
        showLabels ? 'w-60 items-stretch px-3' : 'w-14 items-center px-0',
        isDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ]"
    >
      <div class="flex flex-col gap-5" :class="showLabels ? 'items-stretch' : 'items-center'">
        <div class="flex items-center gap-2" :class="showLabels ? 'justify-between' : 'flex-col'">
          <NuxtLink
            aria-label="Панель WanderLog"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-emerald to-brand-sangria font-headline text-[10px] text-white transition duration-300 hover:-translate-y-0.5 hover:scale-105"
            to="/dashboard"
            @click="closeDrawer"
          >
            W
          </NuxtLink>
          <button
            :aria-expanded="showLabels"
            :aria-label="showLabels ? 'Свернуть боковую панель' : 'Развернуть боковую панель'"
            class="app-chrome-control flex h-8 w-8 items-center justify-center rounded-lg border transition hover:text-brand-gold"
            type="button"
            @click="toggleExpanded"
          >
            <Icon :name="showLabels ? 'tabler:layout-sidebar-left-collapse' : 'tabler:layout-sidebar-left-expand'" size="16" />
          </button>
        </div>
        <div class="h-px bg-[var(--app-chrome-border)]" :class="showLabels ? 'w-full' : 'w-6'" />
        <div class="flex flex-col gap-1.5">
          <NuxtLink
            v-for="action in primaryActions"
            :key="action.to"
            :aria-label="action.label"
            class="group relative flex h-10 items-center gap-3 rounded-lg transition duration-300 hover:bg-[var(--app-chrome-control-hover)]"
            :class="[
              showLabels ? 'w-full justify-start px-3' : 'w-10 justify-center px-0',
              isActive(action.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-muted hover:text-[var(--app-chrome-text)]',
            ]"
            :title="showLabels ? undefined : action.label"
            :to="action.to"
            @click="closeDrawer"
          >
            <span
              v-if="isActive(action.to)"
              class="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--app-active-accent)]"
            />
            <Icon
              class="shrink-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-3"
              :name="action.icon"
              size="18"
            />
            <span v-if="showLabels" class="truncate text-sm font-semibold">
              {{ action.label }}
            </span>
            <span
              v-else
              class="app-chrome-strong pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] opacity-0 backdrop-blur-md transition group-hover:translate-x-0 group-hover:opacity-100"
            >
              {{ action.label }}
            </span>
          </NuxtLink>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <NuxtLink
          v-for="action in secondaryActions"
          :key="action.to"
          :aria-label="action.label"
          class="group relative flex h-10 items-center gap-3 rounded-lg transition duration-300 hover:bg-[var(--app-chrome-control-hover)]"
          :class="[
            showLabels ? 'w-full justify-start px-3' : 'w-10 justify-center px-0',
            isActive(action.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-muted hover:text-[var(--app-chrome-text)]',
          ]"
          :title="showLabels ? undefined : action.label"
          :to="action.to"
          @click="closeDrawer"
        >
          <span
            v-if="isActive(action.to)"
            class="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--app-active-accent)]"
          />
          <Icon
            class="shrink-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-3"
            :name="action.icon"
            size="18"
          />
          <span v-if="showLabels" class="truncate text-sm font-semibold">
            {{ action.label }}
          </span>
          <span
            v-else
            class="app-chrome-strong pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] opacity-0 backdrop-blur-md transition group-hover:translate-x-0 group-hover:opacity-100"
          >
            {{ action.label }}
          </span>
        </NuxtLink>
      </div>
    </aside>
  </div>
</template>
