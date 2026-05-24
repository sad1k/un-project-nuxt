<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const error = route.query.error || "Произошла ошибка";
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
    <div role="alert" class="flex w-full items-center justify-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/15 p-5 text-rose-100 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <Icon name="tabler:alert-circle" size="24" />
      <span>Упс! {{ error }}</span>
    </div>
    <NuxtLink
      to="/"
      class="btn border-none bg-brand-gold text-brand-dark hover:bg-white"
    >
      Вернуться на главную
      <Icon
        name="tabler:arrow-left"
        size="24"
      />
    </NuxtLink>
  </div>
</template>
