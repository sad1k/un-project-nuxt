<script lang="ts" setup>
const navItems = [
  { icon: 'tabler:home', to: '/', label: 'Feed' },
  { icon: 'tabler:compass', to: '/explore', label: 'Explore' },
  { icon: 'tabler:map', to: '/dashboard', label: 'My Places' },
]

const route = useRoute()
</script>

<template>
  <div class="absolute top-0 inset-x-0 z-30 px-6 py-4 flex justify-between items-center">
    <!-- Left: Logo + Nav icons -->
    <div class="flex items-center gap-4">
      <NuxtLink to="/" class="font-headline text-white text-xl tracking-tighter uppercase">
        WANDERLOG
      </NuxtLink>
      <div class="flex items-center gap-1 ml-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors tooltip tooltip-bottom"
          :class="route.path === item.to
            ? 'bg-white/15 text-brand-gold'
            : 'text-white/50 hover:text-white hover:bg-white/10'"
          :data-tip="item.label"
        >
          <Icon :name="item.icon" size="20" />
        </NuxtLink>
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <button class="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
        <Icon name="tabler:search" size="18" class="text-white" />
      </button>
      <AuthButton />
    </div>
  </div>
</template>
