<script lang="ts" setup>
import type { InsertLocation } from "~/lib/db/schema";

const locationStore = useLocationStore();
const { $csrfFetch } = useNuxtApp();

const route = useRoute();

async function submit(values: InsertLocation) {
  await $csrfFetch(`/api/locations/${route.params.slug}`, {
    method: "put",
    body: values,
  });
}

function onSubmitComplete() {
  navigateTo({
    name: "dashboard-location-slug",
    params: {
      slug: route.params.slug,
    },
  });
}
</script>

<template>
  <LocationForm
    v-if="locationStore.currentLocationStatus !== 'pending'"
    :on-submit="submit"
    :initial-values="locationStore.currentLocation ?? undefined"
    submit-button-text="Сохранить"
    submit-button-icon="tabler:save"
    :on-submit-complete="onSubmitComplete"
  />
</template>
