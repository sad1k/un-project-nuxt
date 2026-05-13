<script lang="ts" setup>
const { activeVariantId, pointsByVariantId, restoreRouteSession, sessionId, setActiveVariant, variants } = useAiRouteSession();
const {
  refreshRouteGenerationStatus,
  sessions,
  startRouteGenerationStatusPolling,
  stopRouteGenerationStatusPolling,
} = useRouteGenerationStatus();

const otherSessions = computed(() => sessions.value
  .filter(session => session.sessionId !== sessionId.value)
  .slice(0, 5));

onMounted(() => {
  startRouteGenerationStatusPolling();
});

onBeforeUnmount(() => {
  stopRouteGenerationStatusPolling();
});
</script>

<template>
  <section
    v-if="variants.length"
    class="space-y-2"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-900">
        Route history
      </h3>
      <span class="text-xs text-gray-500">{{ variants.length }} variants</span>
    </div>

    <div class="space-y-2">
      <button
        v-for="variant in variants"
        :key="variant.id"
        class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition"
        :class="variant.id === activeVariantId ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'"
        type="button"
        @click="setActiveVariant(variant.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium">
            {{ variant.title || `Route ${variant.id}` }}
          </span>
          <span class="block text-xs opacity-70">
            {{ pointsByVariantId[variant.id]?.length || variant.pointCount }} points - {{ variant.status }}
          </span>
        </span>
        <Icon
          v-if="variant.id === activeVariantId"
          name="tabler:check"
          size="16"
        />
      </button>
    </div>

    <div
      v-if="otherSessions.length"
      class="space-y-2 pt-2"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-900">
          Saved generations
        </h3>
        <button
          class="btn btn-ghost btn-xs text-gray-500"
          type="button"
          @click="refreshRouteGenerationStatus()"
        >
          <Icon name="tabler:refresh" size="14" />
        </button>
      </div>

      <button
        v-for="routeSession in otherSessions"
        :key="routeSession.sessionId"
        class="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-gray-800 transition hover:border-gray-300"
        type="button"
        @click="restoreRouteSession(routeSession.sessionId)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium">
            {{ routeSession.title || routeSession.cityName || `Session ${routeSession.sessionId}` }}
          </span>
          <span class="block text-xs text-gray-500">
            {{ routeSession.pointCount }} points - {{ routeSession.displayStatus }}
          </span>
        </span>
        <Icon
          :class="{ 'animate-spin': routeSession.status === 'generating' && !routeSession.isStale }"
          :name="routeSession.status === 'generating' ? 'tabler:loader-2' : routeSession.status === 'completed' ? 'tabler:map-check' : 'tabler:alert-triangle'"
          size="16"
        />
      </button>
    </div>
  </section>
</template>
