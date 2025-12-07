<script lang="ts" setup>
const route = useRoute();
const locationStore = useLocationStore();
const { currentLocationLog: locationLog, currentLocationLogStatus: status, currentLocationLogError: error } = storeToRefs(locationStore);
const loading = computed(() => status.value === "pending");
const errorMessage = computed(() => error.value?.message);

onMounted(() => {
  locationStore.currentLocationLogRefresh();
});

onBeforeRouteUpdate((to) => {
  if (to.name !== "dashboard-location-slug-id") {
    locationStore.currentLocationRefresh();
  }
});

const { $csrfFetch } = useNuxtApp();

async function deleteLocationLog() {
  await $csrfFetch(`/api/locations/${route.params.slug}/${route.params.id}`, {
    method: "delete",
  });

  navigateTo({
    name: "dashboard-location-slug",
    params: { slug: route.params.slug },
  });
}
</script>

<template>
  <div class="page-content-top h-[600px]">
    <div v-if="loading">
      <span class="loading loading-spinner loading-xl" />
    </div>
    <div v-else-if="errorMessage">
      <p>{{ errorMessage }}</p>
    </div>
    <div v-else-if="route.name === 'dashboard-location-slug-id'">
      <div v-if="locationLog && !loading">
        <h1>
          {{ locationLog.name }}
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
                <a class="flex items-center gap-2 text-error" onclick="deleteLocationLogModal.showModal()">Удалить
                  <Icon name="tabler:trash" size="24" />
                </a>
              </li>
            </ul>
          </div>
        </h1>
        <p>{{ locationLog.description }}</p>
      </div>
      <ImageList
        v-if="locationLog && !loading"
        :location-log="locationLog"
        :loading="loading"
      />
      <div v-if="locationLog && !loading && !locationLog.images.length" class="mt-4">
        <p>Нет изображений. Добавьте первое изображение</p>
        <NuxtLink
          :to="{ name: 'dashboard-location-slug-id-images', params: { slug: route.params.slug, id: route.params.id } }"
          class="btn btn-primary mt-4"
        >
          Добавить изображение <Icon name="tabler:photo" size="24" />
        </NuxtLink>
      </div>
      <dialog id="deleteLocationLogModal" class="modal">
        <div class="modal-box flex flex-col gap-4">
          <h3 class="text-lg font-bold">
            Вы уверены, что хотите удалить это место посещения?
          </h3>
          <div class="flex justify-end gap-2">
            <button class="btn btn-error" @click="deleteLocationLog">
              Удалить
            </button>
            <button class="btn btn-outline" onclick="deleteLocationLogModal.close()">
              Отмена
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>Отмена</button>
        </form>
      </dialog>
    </div>
    <div>
      <NuxtPage />
    </div>
  </div>
</template>
