<script lang="ts" setup>
const navItems = [
  { icon: 'tabler:home', to: '/', label: 'Feed' },
  { icon: 'tabler:compass', to: '/explore', label: 'Explore' },
  { icon: 'tabler:map', to: '/dashboard', label: 'My Places' },
]

const quickActions = [
  { icon: 'tabler:bookmark', label: 'Saved' },
  { icon: 'tabler:share', label: 'Share' },
  { icon: 'tabler:settings', label: 'Settings' },
]

const route = useRoute()
</script>

<template>
  <div class="absolute left-0 top-0 bottom-0 z-30 w-14 bg-brand-dark/60 backdrop-blur-md border-r border-white/5 flex flex-col items-center py-4 gap-1">
    <!-- Logo icon -->
    <NuxtLink to="/" class="w-10 h-10 rounded-xl bg-brand-emerald/20 flex items-center justify-center mb-4">
      <Icon name="tabler:compass" size="22" class="text-brand-emerald" />
    </NuxtLink>

    <!-- Nav items -->
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="w-10 h-10 rounded-xl flex items-center justify-center transition-all tooltip tooltip-right"
      :class="route.path === item.to
        ? 'bg-white/10 text-brand-gold'
        : 'text-white/40 hover:text-white hover:bg-white/5'"
      :data-tip="item.label"
    >
      <Icon :name="item.icon" size="22" />
    </NuxtLink>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Quick actions -->
    <button
      v-for="action in quickActions"
      :key="action.icon"
      class="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all tooltip tooltip-right"
      :data-tip="action.label"
    >
      <Icon :name="action.icon" size="20" />
    </button>
  </div>
</template>
