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
  <div class="container max-w-md mx-auto mt-4 p-4">
    <div class="my-4">
      <h1 class="text-lg">
        Добавить место
      </h1>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Здесь вы можете добавить место, которое вы посетили. Это поможет вам
        запомнить ваш путь и поделиться им с другими. Просто нажмите на кнопку
        "Добавить место" и заполните необходимую информацию. После этого ваше
        место будет добавлено в вашу ленту историй.
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
