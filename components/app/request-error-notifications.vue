<script lang="ts" setup>
import { Toaster } from "vue-sonner";
import "vue-sonner/style.css";

const colorMode = useColorMode();
const toasterTheme = computed(() => colorMode.value === "dark" ? "dark" : "light");
</script>

<template>
  <Toaster
    close-button
    rich-colors
    :theme="toasterTheme"
    position="top-right"
    :offset="{ top: '5rem', right: '1rem' }"
    :mobile-offset="{ top: '5rem', right: '0.75rem', left: '0.75rem' }"
    container-aria-label="Уведомления об ошибках запросов"
  />
</template>
