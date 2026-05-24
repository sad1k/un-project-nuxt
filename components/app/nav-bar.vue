<template>
  <nav class="app-chrome fixed inset-x-0 top-0 z-50 h-16 border-b backdrop-blur-2xl">
    <div class="flex h-full items-center gap-3 px-3 sm:px-4 lg:px-6">
      <NuxtLink
        class="app-chrome-text flex shrink-0 items-center gap-2 font-headline text-sm font-bold uppercase tracking-tight transition hover:text-brand-gold sm:text-lg"
        to="/"
      >
        <span class="app-chrome-control grid h-8 w-8 place-items-center rounded-full border">
          <Icon name="tabler:plane-tilt" size="16" />
        </span>
        <span class="hidden sm:inline">WanderLog</span>
      </NuxtLink>

      <AppGlobalSearch class="min-w-0 flex-1" />

      <div class="flex shrink-0 items-center gap-2">
        <div class="hidden sm:block">
          <AppRouteGenerationIndicator />
        </div>
        <AppThemeToggle />
        <AppUserMenu />
      </div>
    </div>
  </nav>
</template>
