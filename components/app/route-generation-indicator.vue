<script lang="ts" setup>
const props = defineProps<{
  floating?: boolean;
}>();

const {
  activeGenerationSessions,
  hasActiveGeneration,
  latestCompletedSession,
  latestStaleGenerationSession,
  refreshRouteGenerationStatus,
  sessions,
  startRouteGenerationStatusPolling,
  stopRouteGenerationStatusPolling,
} = useRouteGenerationStatus();
const {
  browserNotificationsEnabled,
  dismissRouteGenerationNotification,
  lastNotification,
  requestRouteGenerationNotifications,
} = useRouteGenerationNotifications();

const visibleSessions = computed(() => activeGenerationSessions.value.length
  ? activeGenerationSessions.value
  : sessions.value.slice(0, 3));

const title = computed(() => {
  if (activeGenerationSessions.value.length > 1) {
    return `Генерируется маршрутов: ${activeGenerationSessions.value.length}`;
  }

  if (activeGenerationSessions.value.length === 1) {
    return activeGenerationSessions.value[0].cityName
      ? `Генерируем ${activeGenerationSessions.value[0].cityName}`
      : "Генерируем маршрут";
  }

  if (latestStaleGenerationSession.value) {
    return latestStaleGenerationSession.value.cityName
      ? `Маршрут ${latestStaleGenerationSession.value.cityName} завис`
      : "Маршрут завис";
  }

  if (latestCompletedSession.value) {
    return latestCompletedSession.value.cityName
      ? `Маршрут ${latestCompletedSession.value.cityName} готов`
      : "Маршрут готов";
  }

  return "Генерация маршрута";
});

onMounted(() => {
  startRouteGenerationStatusPolling();
});

onBeforeUnmount(() => {
  stopRouteGenerationStatusPolling();
});

function getSessionIcon(session: { status: "generating" | "completed" | "failed"; isStale: boolean }) {
  if (session.isStale)
    return "tabler:alert-triangle";

  if (session.status === "generating")
    return "tabler:loader-2";

  if (session.status === "completed")
    return "tabler:map-check";

  return "tabler:alert-triangle";
}

function formatDisplayStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "готово",
    failed: "ошибка",
    generating: "генерируется",
    stale: "зависло",
  };

  return labels[status] || status;
}
</script>

<template>
  <div
    v-if="hasActiveGeneration || latestStaleGenerationSession || latestCompletedSession"
    class="dropdown dropdown-end"
    :class="{ 'pointer-events-auto': props.floating }"
  >
    <button
      class="app-chrome-control btn btn-sm gap-2 border shadow-sm hover:text-brand-gold"
      :class="{ 'rounded-full': props.floating }"
      type="button"
      tabindex="0"
      @click="refreshRouteGenerationStatus()"
    >
      <Icon
        :class="{ 'animate-spin': hasActiveGeneration }"
        :name="hasActiveGeneration ? 'tabler:loader-2' : latestStaleGenerationSession ? 'tabler:alert-triangle' : 'tabler:check'"
        size="16"
      />
      <span class="max-w-44 truncate text-xs font-medium">{{ title }}</span>
    </button>

    <div
      class="app-chrome-strong dropdown-content z-50 mt-2 w-80 rounded-lg border p-3 shadow-xl max-md:fixed max-md:inset-x-3 max-md:top-[64px] max-md:mt-0 max-md:w-auto max-md:max-h-[70vh] max-md:overflow-y-auto"
      tabindex="0"
    >
      <div
        v-if="lastNotification"
        class="explore-status-success mb-3 rounded-lg border p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">
              {{ lastNotification.title }}
            </p>
            <p class="mt-1 text-xs">
              {{ lastNotification.body }}
            </p>
          </div>
          <button
            aria-label="Закрыть уведомление о маршруте"
            class="btn btn-ghost btn-xs"
            type="button"
            @click="dismissRouteGenerationNotification()"
          >
            <Icon name="tabler:x" size="14" />
          </button>
        </div>
      </div>

      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-semibold">
          Генерации маршрутов
        </p>
        <button
          class="btn btn-ghost btn-xs"
          type="button"
          @click="refreshRouteGenerationStatus()"
        >
          <Icon name="tabler:refresh" size="14" />
        </button>
      </div>

      <button
        v-if="!browserNotificationsEnabled"
        class="app-chrome-control mb-3 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition"
        type="button"
        @click="requestRouteGenerationNotifications()"
      >
        <Icon name="tabler:bell" size="14" />
        Включить уведомления браузера
      </button>

      <div class="space-y-2">
        <NuxtLink
          v-for="session in visibleSessions"
          :key="session.sessionId"
          class="app-chrome-control flex items-center justify-between rounded-md border px-3 py-2 text-left transition"
          :to="{ path: '/explore', query: { sessionId: session.sessionId } }"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">
              {{ session.title || session.cityName || `Маршрут ${session.sessionId}` }}
            </span>
            <span class="app-chrome-faint block text-xs">
              {{ session.pointCount }} точек - {{ formatDisplayStatus(session.displayStatus) }}
            </span>
          </span>
          <Icon
            :class="{ 'animate-spin': session.status === 'generating' && !session.isStale }"
            :name="getSessionIcon(session)"
            size="18"
          />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
