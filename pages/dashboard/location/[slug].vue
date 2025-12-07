<script lang="ts" setup>
import type { FetchError } from "ofetch";

const route = useRoute();
const locationStore = useLocationStore();
const { currentLocation: location, currentLocationStatus: status, currentLocationError: error } = storeToRefs(locationStore);

const { $csrfFetch } = useNuxtApp();

const deleteError = ref<string | null>(null);
const isDeleting = ref<boolean>(false);

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
    <div v-if="loading">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else-if="errorMessage">
      <p>{{ errorMessage }}</p>
    </div>
    <div v-else-if="route.name === 'dashboard-location-slug'">
      <div v-if="location && !loading">
        <h1>
          {{ location.name }}
          <div class="dropdown dropdown-start">
            <div
              tabindex="0"
              role="button"
              class="btn m-1"
            >
              <Icon name="tabler:dots" size="24" />
            </div>
            <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
              <li>
                <a class="flex items-center gap-2 text-error" onclick="deleteLocationModal.showModal()">Удалить
                  <Icon name="tabler:trash" size="24" />
                </a>
              </li>
            </ul>
          </div>
        </h1>
        <p>{{ location.description }}</p>
      </div>
      <dialog id="deleteLocationModal" class="modal">
        <div class="modal-box flex flex-col gap-4">
          <h3 class="text-lg font-bold">
            Вы уверены, что хотите удалить это место?
          </h3>
          <div class="flex justify-end gap-2">
            <button class="btn btn-error" @click="deleteLocation">
              Удалить
            </button>
            <button class="btn btn-outline" onclick="deleteLocationModal.close()">
              Отмена
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>Отмена</button>
        </form>
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
