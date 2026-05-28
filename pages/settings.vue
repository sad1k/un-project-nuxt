<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});
</script>

<template>
  <div class="page-content-top mx-auto max-w-2xl px-4 py-6">
    <h1 class="mb-6 text-xl font-bold">
      Настройки
    </h1>
    <div class="flex flex-col gap-4">
      <SettingsNotificationsSection />
    </div>
  </div>
</template>
