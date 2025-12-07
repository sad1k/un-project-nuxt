<script lang="ts" setup>
import type { InsertLocationLog } from "~/lib/db/schema";

const locationStore = useLocationStore();
const { $csrfFetch } = useNuxtApp();

const route = useRoute();

async function submit(values: InsertLocationLog) {
  await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}`, {
    method: "put",
    body: values,
  });
}

function onSubmitComplete() {
  navigateTo({
    name: "dashboard-location-slug-id",
    params: {
      slug: route.params.slug,
      id: route.params.id,
    },
  });
}
</script>

<template>
  <LocationFormAdd
    :on-submit="submit"
    submit-button-text="Сохранить"
    submit-button-icon="tabler:save"
    :on-submit-complete="onSubmitComplete"
    :initial-values="locationStore.currentLocationLog!"
  />
</template>
