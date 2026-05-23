<script lang="ts" setup>
import type { InsertLocation } from "~/lib/db/schema";

// Define types for reactive variables

const { $csrfFetch } = useNuxtApp();

async function submit(values: InsertLocation) {
  await $csrfFetch("/api/locations", {
    method: "post",
    body: values,
  });
}

function onSubmitComplete() {
  navigateTo("/dashboard");
}
</script>

<template>
  <div class="w-full px-4 py-6 lg:mx-auto lg:max-w-2xl lg:px-6">
    <div class="my-4">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.28em] text-brand-gold/70">
        WanderLog
      </p>
      <h1 class="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl dark:text-white">
        Добавить место
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-gray-600 dark:text-white/55">
        Здесь вы можете добавить место, которое вы посетили. Это поможет вам
        запомнить ваш путь и поделиться им с другими. Просто нажмите на кнопку
        "Добавить место" и заполните необходимую информацию.
      </p>
    </div>

    <LocationForm
      :on-submit="submit"
      submit-button-text="Добавить"
      submit-button-icon="tabler:circle-plus-filled"
      :on-submit-complete="onSubmitComplete"
    />
  </div>
</template>
