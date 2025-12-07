<script lang="ts" setup>
import type { InsertLocationLog } from "~/lib/db/schema";

import { CENTER_RUSSIA } from "~/lib/constants";

const route = useRoute();

const locationStore = useLocationStore();
const { currentLocation, currentLocationStatus } = storeToRefs(locationStore);
const { $csrfFetch } = useNuxtApp();

async function onSubmit(values: InsertLocationLog) {
  await $csrfFetch(`/api/locations/${route.params.slug}/add`, {
    method: "post",
    body: values,
  });
}

function onSubmitComplete() {
  navigateTo({
    name: "dashboard-location-slug",
    params: { slug: route.params.slug },
  });
}
</script>

<template>
  <div v-if="currentLocationStatus !== 'pending'" class="p-4 min-h-50">
    <LocationFormAdd
      :on-submit="onSubmit"
      submit-button-text="Добавить"
      submit-button-icon="tabler:circle-plus-filled"
      :on-submit-complete="onSubmitComplete"
      :initial-values="{ name: '',
                         description: '',
                         startedAt: Date.now() - (24 * 60 * 60 * 1000),
                         endedAt: Date.now(),
                         lat: currentLocation?.lat || CENTER_RUSSIA[1],
                         long: currentLocation?.long || CENTER_RUSSIA[0] }"
    />
  </div>
</template>
