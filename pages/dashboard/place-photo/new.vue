<script lang="ts" setup>
const router = useRouter();
const locationStore = useLocationStore();

async function onSaved(saved: {
  location: { slug: string };
  locationLog: { id: number };
}) {
  await locationStore.locationsRefresh();
  await router.push(`/dashboard/location/${saved.location.slug}/${saved.locationLog.id}`);
}
</script>

<template>
  <PlacePhotoQuickCapture @saved="onSaved" />
</template>
