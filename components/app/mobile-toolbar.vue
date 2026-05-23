<script lang="ts" setup>
const route = useRoute();

const items = [
  { label: "Карта", icon: "tabler:compass", to: "/explore" },
  { label: "Лента", icon: "tabler:world", to: "/feed" },
  { label: "Места", icon: "tabler:map", to: "/dashboard" },
  { label: "Фото", icon: "tabler:camera-plus", to: "/dashboard/place-photo/new" },
];

function isActive(path: string) {
  if (path === "/dashboard")
    return route.path === "/dashboard" || route.path.startsWith("/dashboard/location");

  return route.path === path;
}
</script>

<template>
  <nav class="app-chrome pwa-bottom-toolbar fixed inset-x-3 bottom-3 z-50 rounded-2xl border px-2 py-2 shadow-2xl backdrop-blur-2xl md:hidden">
    <div class="grid grid-cols-4 gap-1">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        class="group flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-all duration-300"
        :class="isActive(item.to) ? 'bg-[var(--app-chrome-control-hover)] text-[var(--app-active-accent)]' : 'app-chrome-faint hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]'"
        :to="item.to"
      >
        <Icon
          class="transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
          :name="item.icon"
          size="20"
        />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
