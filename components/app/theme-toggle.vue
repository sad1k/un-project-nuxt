<script setup lang="ts">
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set(value: boolean) {
    colorMode.preference = value ? "dark" : "light";
  },
});
</script>

<template>
  <label class="app-chrome-control swap swap-rotate grid h-10 w-10 place-items-center rounded-full border transition hover:text-brand-gold">
    <input v-model="isDark" type="checkbox">

    <Icon
      name="tabler:sun"
      class="swap-on"
      size="24"
    />

    <Icon
      name="tabler:moon-filled"
      class="swap-off"
      size="24"
    />

  </label>
</template>
