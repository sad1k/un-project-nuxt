<script lang="ts" setup>
const route = useRoute();
const fabOpen = ref(false);

const items = [
  { label: "Карта", icon: "tabler:map-2", to: "/explore" },
  { label: "Лента", icon: "tabler:world", to: "/feed" },
  { label: "Фото", icon: "tabler:camera", to: "/dashboard/place-photo/new" },
  { label: "Я", icon: "tabler:user", to: "/dashboard" },
];

function isActive(path: string) {
  if (path === "/dashboard")
    return route.path === "/dashboard" || route.path.startsWith("/dashboard/location");
  return route.path === path;
}

function openFab() { fabOpen.value = true; }
</script>

<template>
  <nav class="app-chrome pwa-bottom-toolbar fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-end rounded-t-2xl border-t md:hidden">
    <NuxtLink
      v-for="item in items.slice(0, 2)"
      :key="item.to"
      :to="item.to"
      :aria-current="isActive(item.to) ? 'page' : undefined"
      class="flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium motion-safe:transition-transform active:scale-95"
      :class="isActive(item.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-faint'"
    >
      <Icon :name="item.icon" size="24" />
      <span class="truncate">{{ item.label }}</span>
      <span v-if="isActive(item.to)" class="h-1 w-1 rounded-full bg-[var(--app-active-accent)]" />
    </NuxtLink>

    <button
      type="button"
      aria-label="Создать"
      class="relative -mt-4 flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30 motion-safe:transition-transform active:scale-95"
      @click="openFab"
    >
      <Icon name="tabler:plus" size="28" />
    </button>

    <NuxtLink
      v-for="item in items.slice(2)"
      :key="item.to"
      :to="item.to"
      :aria-current="isActive(item.to) ? 'page' : undefined"
      class="flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium motion-safe:transition-transform active:scale-95"
      :class="isActive(item.to) ? 'text-[var(--app-active-accent)]' : 'app-chrome-faint'"
    >
      <Icon :name="item.icon" size="24" />
      <span class="truncate">{{ item.label }}</span>
      <span v-if="isActive(item.to)" class="h-1 w-1 rounded-full bg-[var(--app-active-accent)]" />
    </NuxtLink>

    <AppActionSheet v-model:open="fabOpen" title="Создать">
      <ul class="flex flex-col gap-1">
        <li>
          <NuxtLink to="/dashboard/add" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:map-pin-plus" size="22" />
            <div>
              <div class="text-sm font-semibold">Добавить место</div>
              <div class="text-xs text-gray-500">Сохранить локацию в дневник</div>
            </div>
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/dashboard/place-photo/new" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:camera-plus" size="22" />
            <div>
              <div class="text-sm font-semibold">Быстрое фото</div>
              <div class="text-xs text-gray-500">Прикрепить фото к месту</div>
            </div>
          </NuxtLink>
        </li>
        <li>
          <NuxtLink to="/dashboard/publish" class="flex items-center gap-3 rounded-xl px-3 py-3 active:bg-gray-100 dark:active:bg-white/10" @click="fabOpen = false">
            <Icon name="tabler:send" size="22" />
            <div>
              <div class="text-sm font-semibold">Опубликовать пост</div>
              <div class="text-xs text-gray-500">Поделиться с лентой</div>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </AppActionSheet>
  </nav>
</template>
