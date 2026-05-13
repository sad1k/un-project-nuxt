<template>
  <div class="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-4">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
        <Icon
          class="text-white"
          name="tabler:compass"
          size="22"
        />
      </div>
      <span class="font-headline text-xl font-bold text-white">WanderLog</span>
    </div>

    <div class="flex items-center gap-6">
      <NuxtLink
        class="border-b-2 border-amber-400 pb-1 text-sm font-medium text-white"
        to="/explore"
      >
        Explore
      </NuxtLink>
      <NuxtLink
        class="text-sm font-medium text-white/60 transition-colors hover:text-white/80"
        to="/location/my"
      >
        Diary
      </NuxtLink>
      <NuxtLink
        class="text-sm font-medium text-white/60 transition-colors hover:text-white/80"
        to="/location/create"
      >
        Add place
      </NuxtLink>
    </div>

    <div class="flex items-center gap-3">
      <button
        aria-label="Search"
        class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
        type="button"
      >
        <Icon
          class="text-white"
          name="tabler:search"
          size="18"
        />
      </button>
      <div class="h-10 w-10 rounded-full bg-gray-400" />
    </div>
  </div>
</template>
