<script lang="ts">
// const searchQuery = ref<string>("");

// async function onSearch() {
//   const data = await $fetch("/api/search-locations", {
//     query: searchQuery,
//   });

//   return data;
// }
</script>

<template>
  <label class="input w-full">
    <svg
      class="h-[1em] opacity-50"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
    >
      <g
        stroke-linejoin="round"
        stroke-linecap="round"
        stroke-width="2.5"
        fill="none"
        stroke="currentColor"
      >
        <circle
          cx="11"
          cy="11"
          r="8"
        />
        <path d="m21 21-4.3-4.3" />
      </g>
    </svg>
    <input
      type="search"
      required
      placeholder="Search"
    >
  </label>

  <!-- <div
    v-for="searchLocation in searchLocations"
    :key="searchLocation.place_id"
    class="flex flex-col gap-10 "
  >
    <p class="p-2 rounded-2xl border-gray-500 border-2 cursor-pointer">
      {{ searchLocation.display_name }}
    </p>
  </div> -->
</template>
