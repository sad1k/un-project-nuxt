<script lang="ts" setup>
const route = useRoute();

const navItems = [
  { label: "Лента", to: "/feed" },
  { label: "Места", to: "/dashboard" },
];

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <header class="pointer-events-none absolute left-0 right-0 top-0 z-30 px-3 pt-3 md:left-14 md:px-6">
    <div class="pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--explore-border)] bg-[var(--explore-surface)] px-3 py-2 text-[var(--explore-text)] shadow-2xl shadow-[var(--explore-overlay-shadow)] backdrop-blur-2xl md:h-12 md:rounded-none md:border-transparent md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
      <NuxtLink
        class="flex shrink-0 items-center gap-2 font-headline text-sm font-bold uppercase tracking-tight text-[var(--explore-text)] transition hover:text-brand-gold md:text-lg"
        to="/dashboard"
      >
        <span class="grid h-8 w-8 place-items-center rounded-full border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] md:hidden">
          <Icon name="tabler:plane-tilt" size="15" />
        </span>
        <span class="hidden sm:inline">WanderLog</span>
      </NuxtLink>

      <div class="hidden items-center gap-1 rounded-full border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] p-1 lg:flex">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          class="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300"
          :class="isActive(item.to) ? 'bg-[var(--explore-surface-hover)] text-brand-gold' : 'text-[var(--explore-text-soft)] hover:bg-[var(--explore-surface-soft)] hover:text-[var(--explore-text)]'"
          :to="item.to"
        >
          {{ item.label }}
        </NuxtLink>
      </div>

      <AppGlobalSearch class="min-w-0 flex-1 md:max-w-[360px] lg:ml-auto" />

      <button
        aria-label="Сохранённые маршруты"
        class="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] text-[var(--explore-text-muted)] backdrop-blur-xl transition hover:bg-[var(--explore-surface-hover)] sm:flex"
        type="button"
      >
        <Icon name="tabler:bookmark" size="15" />
      </button>

      <AppUserMenu />
    </div>
    <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-[var(--explore-gradient-top)] to-transparent" />
  </header>
</template>
