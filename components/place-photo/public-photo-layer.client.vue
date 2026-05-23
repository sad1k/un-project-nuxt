<script lang="ts" setup>
type PublicPhoto = {
  id: number;
  key: string;
  publicPlaceName: string | null;
  publicLat: number | null;
  publicLong: number | null;
  publishedAt: number | null;
  authorName: string;
};

const config = useRuntimeConfig();
const mapbox = useMapbox();
const markers: any[] = [];

let mbModule: any = null;

const { data: publicPhotos } = await useFetch<{ photos: PublicPhoto[] }>("/api/public/place-photos", {
  default: () => ({ photos: [] }),
});

watch([mapbox.mapLoaded, publicPhotos], async () => {
  await renderPublicPhotos();
}, { immediate: true, deep: true });

onBeforeUnmount(() => {
  clearPublicPhotos();
});

async function getMapboxGL() {
  if (!mbModule) {
    mbModule = await import("mapbox-gl");
  }

  return mbModule.default || mbModule;
}

async function renderPublicPhotos() {
  clearPublicPhotos();

  if (!mapbox.mapLoaded.value || !mapbox.mapInstance.value)
    return;

  const mb = await getMapboxGL();

  for (const photo of publicPhotos.value.photos) {
    if (
      photo.publicLat === null
      || photo.publicLong === null
      || !photo.publicPlaceName
      || photo.publishedAt === null
    ) {
      continue;
    }

    const markerElement = document.createElement("button");
    markerElement.type = "button";
    markerElement.className = "grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-brand-sangria text-white shadow-lg shadow-black/30";
    markerElement.setAttribute("aria-label", photo.publicPlaceName);
    markerElement.innerHTML = "<span class=\"i-tabler-photo-scan h-5 w-5\"></span>";

    const popup = new mb.Popup({
      closeButton: false,
      offset: 18,
    }).setHTML(createPublicPhotoHTML(photo));

    const marker = new mb.Marker({ element: markerElement })
      .setLngLat([photo.publicLong, photo.publicLat])
      .setPopup(popup)
      .addTo(mapbox.mapInstance.value);

    markers.push(marker);
  }
}

function clearPublicPhotos() {
  markers.forEach(marker => marker.remove());
  markers.length = 0;
}

function createPublicPhotoHTML(photo: PublicPhoto) {
  const imageUrl = `${config.public.s3BucketUrl}/${photo.key}`;
  const date = photo.publishedAt ? new Date(photo.publishedAt).toLocaleDateString() : "";

  return `
    <article class="w-64 overflow-hidden rounded-lg bg-[#050505] text-white">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(photo.publicPlaceName ?? "Travel photo")}" class="h-36 w-full object-cover" />
      <div class="space-y-1 p-3">
        <p class="text-sm font-semibold">${escapeHtml(photo.publicPlaceName ?? "")}</p>
        <p class="text-xs text-white/65">${escapeHtml(photo.authorName)}</p>
        <p class="text-xs text-white/45">${escapeHtml(date)}</p>
      </div>
    </article>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
</script>

<template>
  <div class="sr-only" aria-live="polite">
    Public photo map layer
  </div>
</template>
