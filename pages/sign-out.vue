<script setup lang="ts">
const authStore = useAuthStore();

onMounted(() => {
  authStore.signOut();
});
</script>

<template>
  <div class="card bg-base-100 shadow-xl container mx-auto mt-4 min-h-72 text-center flex flex-col justify-center items-center gap-4">
    <span class="loading loading-spinner loading-xl" />
  </div>
</template>
