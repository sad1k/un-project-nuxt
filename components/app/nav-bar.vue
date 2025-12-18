<template>
  <nav class="navbar bg-white text-gray-900 border-b border-gray-200 dark:bg-[#050505] dark:text-white dark:border-white/10 transition-colors duration-300">
    <div class="navbar-start">
      <NuxtLink to="/" class="btn btn-ghost text-xl font-headline tracking-tighter uppercase">
        WANDERLOG
      </NuxtLink>
    </div>
    <div class="navbar-end">
      <AppThemeToggle />
      <div class="ml-2">
        <AuthButton />
      </div>
    </div>
  </nav>
</template>
