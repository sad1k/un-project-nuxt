<script lang="ts" setup>
import { CURRENT_LOCATION_LOG_PAGES, CURRENT_LOCATION_PAGES, EDIT_PAGES, LOCATION_PAGES } from "~/lib/constants";

const isSidebarOpen = ref(true);

const sidebarStore = useSidebarStore();
const mapStore = useMapStore();
const route = useRoute();
const locationStore = useLocationStore();
const { currentLocation: location, currentLocationStatus } = storeToRefs(locationStore);

if (LOCATION_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.locationsRefresh();
}

if (EDIT_PAGES.includes(route.name?.toString() || "") || CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.currentLocationRefresh();
}

if (CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")) {
  await locationStore.currentLocationLogRefresh();
}

onMounted(() => {
  isSidebarOpen.value = localStorage.getItem("isSidebarOpen") === "true";
});

effect(() => {
  console.log(route.params.slug?.toString(), "route.params.slug");

  if (LOCATION_PAGES.includes(route.name?.toString() || "")) {
    sidebarStore.sidebarTopItems = [{
      label: "Места",
      icon: "tabler:map",
      id: "locations",
      to: "/dashboard",
      href: "/dashboard",
    }, {
      label: "Добавить места",
      icon: "tabler:circle-plus-filled",
      id: "add-locations",
      href: "/dashboard/add",
      to: "/dashboard/add",
    }, {
      label: "Опубликовать",
      icon: "tabler:send",
      id: "publish",
      href: "/dashboard/publish",
      to: "/dashboard/publish",
    }, {
      label: "Лента",
      icon: "tabler:world",
      id: "feed",
      href: "/feed",
      to: "/feed",
    }];
  }
  else if (CURRENT_LOCATION_PAGES.includes(route.name?.toString() || "")) {
    sidebarStore.sidebarTopItems = [
      {
        label: "Вернуться к местам",
        icon: "tabler:caret-left",
        id: "back",
        to: "/dashboard",
        href: "/dashboard",
      },
      {
        label: currentLocationStatus.value !== "pending" ? location?.value?.name || "Логи" : "loading...",
        icon: "tabler:map",
        id: "view-logs",
        to: {
          name: "dashboard-location-slug",
          params: {
            slug: route.params.slug,
          },
        },
      },
      {
        label: "Редактировать место",
        icon: "tabler:edit",
        id: "edit-location",
        to: {
          name: "dashboard-location-slug-edit",
          params: {
            slug: route.params.slug,
          },
        },
      },
      {
        label: "Добавить логи",
        icon: "tabler:circle-plus-filled",
        id: "add-logs",
        to: {
          name: "dashboard-location-slug-add",
          params: {
            slug: route.params.slug,
          },
        },
      },
    ];
  }
  else if (CURRENT_LOCATION_LOG_PAGES.includes(route.name?.toString() || "")) {
    sidebarStore.sidebarTopItems = [
      {
        label: `Вернуться к ${location?.value?.name || "Логи"}`,
        icon: "tabler:arrow-left-circle",
        id: "back",
        to: {
          name: "dashboard-location-slug",
          params: {
            slug: route.params.slug,
          },
        },
      },
      {
        label: "Редактировать логи",
        icon: "tabler:edit",
        id: "edit-logs",
        to: {
          name: "dashboard-location-slug-id-edit",
          params: {
            slug: route.params.slug,
            id: route.params.id,
          },
        },
      },
      {
        label: "Посмотреть логи",
        icon: "tabler:eye",
        id: "view-logs",
        to: {
          name: "dashboard-location-slug-id",
          params: {
            slug: route.params.slug,
            id: route.params.id,
          },
        },
      },
      {
        label: "Добавить изображения",
        icon: "tabler:photo",
        id: "add-images",
        to: {
          name: "dashboard-location-slug-id-images",
          params: {
            slug: route.params.slug,
            id: route.params.id,
          },
        },
      },
    ];
  }
});

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
  localStorage.setItem("isSidebarOpen", isSidebarOpen.value.toString());
}
</script>

<template>
  <div class="flex-1 flex bg-gray-50 text-gray-900 dark:bg-[#050505] dark:text-white transition-colors duration-300">
    <div
      class="bg-white border-r border-gray-200 dark:bg-[#050505] dark:border-white/10 transition-all duration-300 shrink-0"
      :class="{ 'w-64': isSidebarOpen, 'w-16': !isSidebarOpen }"
    >
      <div
        class="flex hover:cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 p-2 transition-colors border-b border-gray-200 dark:border-white/5"
        :class="{ 'justify-center': !isSidebarOpen, 'justify-end': isSidebarOpen }"
        @click="toggleSidebar"
      >
        <Icon
          v-if="isSidebarOpen"
          name="tabler:chevron-left"
          size="32"
          class="text-gray-400"
        />
        <Icon
          v-else
          name="tabler:chevron-right"
          size="32"
          class="text-gray-400"
        />
      </div>
      <div class="flex flex-col py-2">
        <SidebarButton
          v-for="item in sidebarStore.sidebarTopItems"
          :key="item.id"
          :label="item.label"
          :show-label="isSidebarOpen"
          :icon="item.icon"
          :to="item.to"
          :href="item.href"
        />
        <div
          v-if="sidebarStore.sidebarItems.length > 0 || sidebarStore.loading"
          class="divider border-gray-200 before:bg-gray-200 after:bg-gray-200 dark:border-white/10 dark:before:bg-white/10 dark:after:bg-white/10"
        />
        <div v-if="sidebarStore.loading" class="px-4">
          <div class="skeleton h-4 w-full bg-gray-200 dark:bg-white/10" />
        </div>
        <div v-if="!sidebarStore.loading && sidebarStore.sidebarItems.length > 0" class="flex flex-col">
          <SidebarButton
            v-for="item in sidebarStore.sidebarItems"
            :key="item.id"
            :label="item.label"
            :show-label="isSidebarOpen"
            :icon="item.icon"
            :to="{ name: 'dashboard-location-slug', params: { slug: item.mapPoint?.slug || '' } }"
            :href="item.href"
            :icon-color="isPointSelected(item.mapPoint, mapStore.selectedPoint) ? 'text-brand-gold' : undefined"
            @mouseenter="mapStore.selectedPoint = item.mapPoint ?? null"
            @mouseleave="mapStore.selectedPoint = null"
          />
        </div>

        <div
          class="divider border-gray-200 before:bg-gray-200 after:bg-gray-200 dark:border-white/10 dark:before:bg-white/10 dark:after:bg-white/10"
        />
        <SidebarButton
          label="Выйти"
          icon="tabler:logout-2"
          href="/sign-out"
          :show-label="isSidebarOpen"
        />
      </div>
    </div>
    <div class="flex-1 overflow-auto bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-300">
      <div class=" flex size-full" :class="{ 'flex-col': !EDIT_PAGES.includes(route.name?.toString() || '') }">
        <NuxtPage />
        <AppMap class="flex-1" />
      </div>
    </div>
  </div>
</template>
