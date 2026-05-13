<script lang="ts" setup>
const props = defineProps<{
  floating?: boolean;
}>();

const {
  activeGenerationSessions,
  hasActiveGeneration,
  latestCompletedSession,
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
    return `${activeGenerationSessions.value.length} routes generating`;
  }

  if (activeGenerationSessions.value.length === 1) {
    return activeGenerationSessions.value[0].cityName
      ? `Generating ${activeGenerationSessions.value[0].cityName}`
      : "Generating route";
  }

  if (latestCompletedSession.value) {
    return latestCompletedSession.value.cityName
      ? `${latestCompletedSession.value.cityName} route ready`
      : "Route ready";
  }

  return "Route generation";
});

onMounted(() => {
  startRouteGenerationStatusPolling();
});

onBeforeUnmount(() => {
  stopRouteGenerationStatusPolling();
});
</script>

<template>
  <div
    v-if="hasActiveGeneration || latestCompletedSession"
    class="dropdown dropdown-end"
    :class="{ 'pointer-events-auto': props.floating }"
  >
    <button
      class="btn btn-sm gap-2 border-gray-200 bg-white text-gray-900 shadow-sm hover:border-gray-300"
      :class="{ 'rounded-full': props.floating }"
      type="button"
      tabindex="0"
      @click="refreshRouteGenerationStatus()"
    >
      <Icon
        :class="{ 'animate-spin': hasActiveGeneration }"
        :name="hasActiveGeneration ? 'tabler:loader-2' : 'tabler:check'"
        size="16"
      />
      <span class="max-w-44 truncate text-xs font-medium">{{ title }}</span>
    </button>

    <div
      class="dropdown-content z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-xl"
      tabindex="0"
    >
      <div
        v-if="lastNotification"
        class="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
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
            aria-label="Dismiss route notification"
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
          Route generations
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
        class="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium transition hover:border-gray-300 hover:bg-gray-50"
        type="button"
        @click="requestRouteGenerationNotifications()"
      >
        <Icon name="tabler:bell" size="14" />
        Enable browser notifications
      </button>

      <div class="space-y-2">
        <NuxtLink
          v-for="session in visibleSessions"
          :key="session.sessionId"
          class="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-left transition hover:border-gray-300 hover:bg-gray-50"
          :to="{ path: '/explore', query: { sessionId: session.sessionId } }"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">
              {{ session.title || session.cityName || `Route ${session.sessionId}` }}
            </span>
            <span class="block text-xs text-gray-500">
              {{ session.pointCount }} points - {{ session.displayStatus }}
            </span>
          </span>
          <Icon
            :class="{ 'animate-spin': session.status === 'generating' && !session.isStale }"
            :name="session.status === 'generating' ? 'tabler:loader-2' : session.status === 'completed' ? 'tabler:map-check' : 'tabler:alert-triangle'"
            size="18"
          />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
