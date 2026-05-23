type NearbyPlacePhotoPlace = {
  id: string;
  name: string;
  description?: string;
  lat: number;
  long: number;
  source: "provider" | "fallback";
};

type CapturePoint = {
  lat: number;
  long: number;
};

type CaptureLocationSource = "gps" | "approximate" | "manual";

type CreatedPrivatePlacePhoto = {
  location: {
    id: number;
    name: string;
    slug: string;
    lat: number;
    long: number;
  };
  locationLog: {
    id: number;
    name: string;
    lat: number;
    long: number;
  };
  upload: {
    signUrl: string;
    imageUrl: string;
  };
  locationAccuracy: number | null;
  locationSource: CaptureLocationSource;
};

type UploadedPlacePhotoImage = {
  id: number;
  key: string;
  visibility: "private" | "public";
  publicPlaceName: string | null;
  publicLat: number | null;
  publicLong: number | null;
  locationAccuracy: number | null;
  locationSource: CaptureLocationSource | null;
};

type SavedPlacePhoto = CreatedPrivatePlacePhoto & {
  image: UploadedPlacePhotoImage;
};

export function usePlacePhotoCapture() {
  const { $csrfFetch } = useNuxtApp();
  const mapStore = useMapStore();

  const photoFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const confirmedPoint = ref<CapturePoint | null>(null);
  const placeName = ref("");
  const locationAccuracy = ref<number | null>(null);
  const locationSource = ref<CaptureLocationSource>("manual");
  const nearbyPlaces = ref<NearbyPlacePhotoPlace[]>([]);
  const loading = ref(false);
  const errorMessage = ref("");
  const saved = ref<SavedPlacePhoto | null>(null);

  const accuracyLabel = computed(() => {
    if (locationSource.value === "manual")
      return "Ручная метка";

    if (locationSource.value === "gps")
      return locationAccuracy.value === null ? "Точный GPS" : `Точный GPS ±${Math.round(locationAccuracy.value)} м`;

    return locationAccuracy.value === null ? "Приблизительный GPS" : `Приблизительный GPS ±${Math.round(locationAccuracy.value)} м`;
  });

  const canSave = computed(() => {
    return Boolean(photoFile.value && confirmedPoint.value && placeName.value.trim() && !loading.value);
  });

  function selectPhoto(file: File | null | undefined) {
    if (!file)
      return;

    if (previewUrl.value)
      URL.revokeObjectURL(previewUrl.value);

    photoFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    errorMessage.value = "";
  }

  async function requestCurrentPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setManualPoint(55.755819, 37.617644);
      errorMessage.value = "Геолокация недоступна. Переместите метку вручную.";
      return;
    }

    loading.value = true;
    errorMessage.value = "";
    mapStore.suppressAddedPointFly = true;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 10000,
        });
      });

      const accuracy = position.coords.accuracy;
      confirmedPoint.value = {
        lat: position.coords.latitude,
        long: position.coords.longitude,
      };
      locationAccuracy.value = accuracy;
      locationSource.value = accuracy <= 100 ? "gps" : "approximate";
      await loadNearbyPlaces();
      await focusMapOnConfirmedPoint();
    }
    catch {
      setManualPoint(55.755819, 37.617644);
      errorMessage.value = "GPS не сработал. Переместите метку вручную и подтвердите место.";
    }
    finally {
      mapStore.suppressAddedPointFly = false;
      loading.value = false;
    }
  }

  function setManualPoint(lat: number, long: number) {
    confirmedPoint.value = { lat, long };
    locationAccuracy.value = null;
    locationSource.value = "manual";
  }

  async function focusMapOnConfirmedPoint() {
    if (!confirmedPoint.value)
      return;

    await nextTick();

    const target = {
      id: 10,
      name: placeName.value.trim() || "Место фото",
      description: "",
      lat: confirmedPoint.value.lat,
      long: confirmedPoint.value.long,
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const adapter = mapStore.adapter;
      if (adapter?.isReady()) {
        await adapter.flyTo({
          center: [target.long, target.lat],
          zoom: 14,
          duration: 1500,
        });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    mapStore.flyToPoint = { ...target };
  }

  async function loadNearbyPlaces() {
    if (!confirmedPoint.value)
      return;

    const response = await $fetch<{ places: NearbyPlacePhotoPlace[] }>("/api/place-photos/nearby-places", {
      query: {
        lat: confirmedPoint.value.lat,
        long: confirmedPoint.value.long,
        accuracy: locationAccuracy.value ?? undefined,
      },
    });

    nearbyPlaces.value = response.places;
    if (!placeName.value && response.places[0]) {
      applyNearbyPlace(response.places[0]);
    }
  }

  function applyNearbyPlace(place: NearbyPlacePhotoPlace) {
    placeName.value = place.name;
    confirmedPoint.value = {
      lat: place.lat,
      long: place.long,
    };
  }

  async function savePrivatePhoto() {
    if (!photoFile.value || !confirmedPoint.value || !placeName.value.trim())
      return null;

    loading.value = true;
    errorMessage.value = "";

    try {
      const created = await $csrfFetch<CreatedPrivatePlacePhoto>("/api/place-photos/create-private", {
        method: "POST",
        body: {
          placeName: placeName.value.trim(),
          lat: confirmedPoint.value.lat,
          long: confirmedPoint.value.long,
          locationAccuracy: locationAccuracy.value,
          locationSource: locationSource.value,
        },
      });

      const uploadBlob = await convertPhotoToUploadBlob(photoFile.value);
      const checksum = await getChecksum(uploadBlob);
      const signed = await $csrfFetch<{ url: string; fields: Record<string, string>; key: string }>(created.upload.signUrl, {
        method: "POST",
        body: {
          checksum,
          contentLength: uploadBlob.size,
        },
      });

      const formData = new FormData();
      Object.entries(signed.fields).forEach(([key, value]) => formData.append(key, value));
      formData.append("file", uploadBlob);

      await $fetch(signed.url, {
        method: "POST",
        body: formData,
      });

      const image = await $csrfFetch<UploadedPlacePhotoImage>(created.upload.imageUrl, {
        method: "POST",
        body: {
          key: signed.key,
        },
      });

      saved.value = { ...created, image };
      return saved.value;
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Не удалось сохранить фото";
      return null;
    }
    finally {
      loading.value = false;
    }
  }

  onBeforeUnmount(() => {
    if (previewUrl.value)
      URL.revokeObjectURL(previewUrl.value);
  });

  return {
    photoFile,
    previewUrl,
    confirmedPoint,
    placeName,
    locationAccuracy,
    locationSource,
    nearbyPlaces,
    loading,
    errorMessage,
    saved,
    accuracyLabel,
    canSave,
    selectPhoto,
    requestCurrentPosition,
    setManualPoint,
    loadNearbyPlaces,
    applyNearbyPlace,
    savePrivatePhoto,
  };
}

async function getChecksum(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function convertPhotoToUploadBlob(file: File) {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  try {
    image.src = objectUrl;
    await image.decode();

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });

    return blob ?? file;
  }
  finally {
    URL.revokeObjectURL(objectUrl);
  }
}
