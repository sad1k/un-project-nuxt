<script lang="ts" setup>
const { activeVariantId, pointsByVariantId, restoreRouteSession, sessionId, setActiveVariant, variants } = useAiRouteSession();
const {
  deleteRouteGenerationSession,
  deletingSessionIds,
  refreshRouteGenerationStatus,
  sessions,
  startRouteGenerationStatusPolling,
  stopRouteGenerationStatusPolling,
} = useRouteGenerationStatus();

const otherSessions = computed(() => sessions.value
  .filter(session => session.sessionId !== sessionId.value)
  .slice(0, 5));

function getDiarySaveLabel(input?: { savedCount: number; expectedPointCount: number; status: string } | null) {
  if (!input)
    return "Точки маршрута не сохранены";

  if (input.status === "saved")
    return `В дневнике ${input.savedCount}/${input.expectedPointCount}`;

  if (input.status === "failed")
    return "Не удалось сохранить в дневник";

  if (input.status === "partial")
    return `Частично в дневнике ${input.savedCount}/${input.expectedPointCount}`;

  return "Точки маршрута не сохранены";
}

function getDiarySaveIcon(input?: { status: string } | null) {
  if (input?.status === "saved")
    return "tabler:bookmarks";

  if (input?.status === "failed")
    return "tabler:alert-triangle";

  return "tabler:bookmark-plus";
}

function getRouteSessionLabel(routeSession: { cityName: string | null; sessionId: number; title: string | null }) {
  return routeSession.title || routeSession.cityName || `Сессия ${routeSession.sessionId}`;
}

function formatRouteStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "готово",
    failed: "ошибка",
    generating: "генерируется",
    stale: "зависло",
  };

  return labels[status] || status;
}

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
      <h3 class="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--explore-text-faint)]">
        История маршрутов
      </h3>
      <span class="text-xs text-[var(--explore-text-soft)]">{{ variants.length }} вариантов</span>
    </div>

    <div class="space-y-2">
      <button
        v-for="variant in variants"
        :key="variant.id"
        class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition"
        :class="variant.id === activeVariantId ? 'border-brand-gold/35 bg-brand-gold/10 text-[var(--explore-text)]' : 'border-[var(--explore-border)] bg-[var(--explore-surface-soft)] text-[var(--explore-text-muted)] hover:border-[var(--explore-border-strong)]'"
        type="button"
        @click="setActiveVariant(variant.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium">
            {{ variant.title || `Маршрут ${variant.id}` }}
          </span>
          <span class="block text-xs opacity-70">
            {{ pointsByVariantId[variant.id]?.length || variant.pointCount }} точек - {{ formatRouteStatus(variant.status) }}
          </span>
          <span
            v-if="variant.status === 'completed'"
            class="mt-1 flex items-center gap-1 text-xs opacity-80"
          >
            <Icon
              :name="getDiarySaveIcon(variant.diarySave)"
              size="13"
            />
            {{ getDiarySaveLabel(variant.diarySave) }}
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
        <h3 class="text-sm font-semibold text-[var(--explore-text)]">
          Сохранённые генерации
        </h3>
        <button
          class="btn btn-ghost btn-xs text-[var(--explore-text-soft)] hover:text-[var(--explore-text)]"
          type="button"
          @click="refreshRouteGenerationStatus()"
        >
          <Icon name="tabler:refresh" size="14" />
        </button>
      </div>

      <div
        v-for="routeSession in otherSessions"
        :key="routeSession.sessionId"
        class="flex w-full items-center justify-between rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] px-3 py-2 text-left text-[var(--explore-text-muted)] transition hover:border-[var(--explore-border-strong)]"
      >
        <button
          class="min-w-0 flex-1 text-left"
          type="button"
          @click="restoreRouteSession(routeSession.sessionId)"
        >
          <span class="block truncate text-sm font-medium">
            {{ getRouteSessionLabel(routeSession) }}
          </span>
          <span class="block text-xs text-[var(--explore-text-soft)]">
            {{ routeSession.pointCount }} точек - {{ formatRouteStatus(routeSession.displayStatus) }}
          </span>
          <span
            v-if="routeSession.status === 'completed'"
            class="mt-1 flex items-center gap-1 text-xs text-[var(--explore-text-soft)]"
          >
            <Icon
              :name="getDiarySaveIcon(routeSession.diarySave)"
              size="13"
            />
            {{ getDiarySaveLabel(routeSession.diarySave) }}
          </span>
        </button>
        <span class="ml-3 flex shrink-0 items-center gap-1">
          <Icon
            :class="{ 'animate-spin': routeSession.status === 'generating' && !routeSession.isStale }"
            :name="routeSession.status === 'generating' ? 'tabler:loader-2' : routeSession.status === 'completed' ? 'tabler:map-check' : 'tabler:alert-triangle'"
            size="16"
          />
          <button
            :aria-label="`Удалить ${getRouteSessionLabel(routeSession)} из истории маршрутов`"
            class="btn btn-ghost btn-xs text-[var(--explore-text-soft)] hover:text-[var(--explore-danger-text)]"
            :disabled="deletingSessionIds.includes(routeSession.sessionId)"
            type="button"
            @click="deleteRouteGenerationSession(routeSession.sessionId)"
          >
            <Icon
              :class="{ 'animate-spin': deletingSessionIds.includes(routeSession.sessionId) }"
              :name="deletingSessionIds.includes(routeSession.sessionId) ? 'tabler:loader-2' : 'tabler:trash'"
              size="15"
            />
          </button>
        </span>
      </div>
    </div>
  </section>
</template>
