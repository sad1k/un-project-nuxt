<script lang="ts" setup>
import type { FetchError } from "ofetch";

const route = useRoute();
const locationStore = useLocationStore();
const { currentLocation: location, currentLocationStatus: status, currentLocationError: error } = storeToRefs(locationStore);

const { $csrfFetch } = useNuxtApp();

const deleteError = ref<string | null>(null);
const isDeleting = ref<boolean>(false);
const deleteDialog = ref<HTMLDialogElement | null>(null);
const mapStore = useMapStore();

const loading = computed(() => status.value === "pending" || isDeleting.value);
const errorMessage = computed(() => deleteError.value || error.value?.message);

onMounted(() => {
  locationStore.currentLocationRefresh();
});

onBeforeRouteUpdate((to) => {
  if (to.name !== "dashboard-location-slug") {
    locationStore.currentLocationRefresh();
  }
});

function openDelete() { deleteDialog.value?.showModal(); }
function closeDelete() { deleteDialog.value?.close(); }

function showOnMap() {
  if (location.value) {
    mapStore.flyToPoint = createMapPointFromLocation(location.value);
    mapStore.showMapPeek?.();
  }
}

async function deleteLocation() {
  try {
    isDeleting.value = true;
    await $csrfFetch(`/api/locations/${route.params.slug}`, {
      method: "delete",
    });

    navigateTo("/dashboard");
  }
  catch (e) {
    const error = e as FetchError;
    deleteError.value = error.data?.statusMessage || error.statusMessage || "Неизвестная ошибка";
  }
  finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="page-content-top">
    <header class="app-chrome sticky top-16 z-30 -mx-4 mb-3 flex h-12 items-center justify-between border-b px-4 md:hidden">
      <button type="button" class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Назад" @click="$router.back()">
        <Icon name="tabler:chevron-left" size="18" />
      </button>
      <div class="truncate px-3 text-sm font-semibold">{{ location?.name }}</div>
      <div class="dropdown dropdown-end">
        <button tabindex="0" type="button" class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Ещё">
          <Icon name="tabler:dots" size="18" />
        </button>
        <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-52 p-2 shadow">
          <li><button class="flex items-center gap-2 text-error" @click="openDelete">Удалить<Icon name="tabler:trash" size="18" /></button></li>
        </ul>
      </div>
    </header>

    <div v-if="loading">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else-if="errorMessage">
      <p>{{ errorMessage }}</p>
    </div>
    <div v-else-if="route.name === 'dashboard-location-slug'">
      <div v-if="location && !loading" class="max-w-prose">
        <div class="flex items-start justify-between gap-3">
          <h1 class="text-2xl font-bold tracking-tight text-gray-950 dark:text-white">{{ location.name }}</h1>
          <div class="hidden dropdown dropdown-end md:block">
            <button tabindex="0" type="button" class="app-chrome-control flex h-10 w-10 items-center justify-center rounded-xl border" aria-label="Ещё">
              <Icon name="tabler:dots" size="18" />
            </button>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-52 p-2 shadow">
              <li><button class="flex items-center gap-2 text-error" @click="openDelete">Удалить<Icon name="tabler:trash" size="18" /></button></li>
            </ul>
          </div>
        </div>
        <p v-if="location.description" class="mt-2 break-words text-gray-600 dark:text-white/60">{{ location.description }}</p>
        <button type="button" class="app-chrome-control mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm md:hidden" @click="showOnMap">
          <Icon name="tabler:map-pin" size="16" /> Показать на карте
        </button>
      </div>
      <dialog ref="deleteDialog" class="modal">
        <div class="modal-box flex flex-col gap-4">
          <h3 class="text-lg font-bold">Вы уверены, что хотите удалить это место?</h3>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-error" @click="deleteLocation">Удалить</button>
            <button type="button" class="btn btn-outline" @click="closeDelete">Отмена</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="button">Отмена</button></form>
      </dialog>
      <div v-if="location && location.locationLogs && !location.locationLogs.length" class="mt-4">
        <p>Нет логов посещения. Добавьте первое место посещения</p>
        <NuxtLink
          :to="{ name: 'dashboard-location-slug-add', params: { slug: route.params.slug } }"
          class="btn btn-primary mt-4"
        >
          Добавить место посещения
        </NuxtLink>
      </div>
      <div v-else-if="location && !loading && location.locationLogs && location.locationLogs.length" class="location-list">
        <LocationCard
          v-for="log in location.locationLogs"
          :key="log.id"
          :map-point="createMapPointFromLocationLog(log, route.params.slug as string)"
        >
          <template #top>
            <span v-if="log.startedAt !== log.endedAt" class="text-sm italic text-gray-500"> {{
              formatDate(log.startedAt) }} - {{ formatDate(log.endedAt) }}
            </span>
            <span v-else class="text-sm italic text-gray-500"> {{ formatDate(log.startedAt) }} </span>
          </template>
        </LocationCard>
      </div>
    </div>
    <div>
      <NuxtPage />
    </div>
  </div>
</template>
