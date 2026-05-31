<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{
  point: RouteMapPoint | null;
  sessionId: number | null;
  variantId: number | null;
}>();

const placeStory = usePlaceStory();
const { isOffline } = useOnline();
const request = computed(() => placeStory.createRequest({
  point: props.point,
  sessionId: props.sessionId,
  variantId: props.variantId,
}));
const state = computed(() => placeStory.getState(request.value));
const story = computed(() => state.value.story);
const progressPercent = computed(() => {
  if (!state.value.durationSeconds)
    return 0;

  return Math.min(100, Math.round((state.value.progressSeconds / state.value.durationSeconds) * 100));
});
const primaryLabel = computed(() => {
  if (state.value.status === "generating")
    return "Готовим историю";

  if (state.value.status === "playing")
    return "Пауза";

  if (state.value.status === "paused")
    return "Продолжить";

  if (state.value.status === "ended")
    return "Повторить";

  if (story.value?.audio)
    return "Слушать";

  return "Слушать историю";
});
const primaryIcon = computed(() => {
  if (state.value.status === "generating")
    return "tabler:loader-2";

  if (state.value.status === "playing")
    return "tabler:player-pause";

  if (state.value.status === "ended")
    return "tabler:rotate-clockwise";

  return "tabler:player-play";
});
const canUseStory = computed(() => Boolean(request.value && props.point));
const offlineLabel = computed(() => {
  if (state.value.offlineStatus === "saved")
    return "Доступно офлайн";

  if (state.value.offlineStatus === "saving")
    return "Сохраняем";

  if (state.value.offlineStatus === "removing")
    return "Удаляем";

  if (state.value.offlineStatus === "unavailable_offline")
    return "История не сохранена офлайн";

  if (state.value.offlineStatus === "unsupported")
    return "Офлайн-сохранение недоступно";

  return "Не сохранено офлайн";
});

watch(
  request,
  (nextRequest, previousRequest) => {
    if (previousRequest)
      placeStory.pause(previousRequest);

    if (nextRequest)
      void placeStory.loadStatus(nextRequest);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  placeStory.cleanup(request.value);
});

async function handlePrimaryAction() {
  if (!request.value)
    return;

  if (state.value.status === "ended") {
    await placeStory.replay(request.value);
    return;
  }

  await placeStory.togglePlayback(request.value);
}

async function handleOfflineAction() {
  if (!request.value)
    return;

  if (state.value.offlineStatus === "saved") {
    await placeStory.removeOffline(request.value);
    return;
  }

  await placeStory.saveOffline(request.value);
}
</script>

<template>
  <section
    v-if="point"
    class="rounded-lg border border-brand-gold/20 bg-brand-gold/10 p-3"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase text-brand-gold">
          История места
        </p>
        <h3 class="mt-1 truncate text-sm font-bold text-[var(--explore-text)]">
          {{ story?.title || point.name }}
        </h3>
      </div>
      <span class="shrink-0 rounded-full bg-[var(--explore-surface-hover)] px-2 py-1 text-[10px] font-semibold text-brand-gold">
        День {{ point.day }}
      </span>
    </div>

    <p class="mt-2 text-xs leading-5 text-[var(--explore-text-muted)]">
      {{ story?.sourceNote || "На основе данных из источников и контекста маршрута." }}
    </p>
    <p class="mt-1 text-[11px] text-[var(--explore-text-faint)]">
      {{ story?.disclosure || "Аудиорассказ сгенерирован AI." }}
    </p>

    <div
      v-if="state.status === 'unavailable' || state.offlineStatus === 'unavailable_offline'"
      class="mt-3 rounded-md bg-[var(--explore-surface-soft)] px-3 py-2 text-xs text-[var(--explore-text-muted)]"
    >
      {{ state.offlineStatus === "unavailable_offline" ? "История не сохранена офлайн." : "История недоступна, пока не появится больше фактов о месте из источников." }}
    </div>

    <div
      v-else-if="state.status === 'error'"
      class="mt-3 rounded-md bg-[var(--explore-danger-bg)] px-3 py-2 text-xs text-[var(--explore-danger-text)]"
    >
      {{ state.error || "Не удалось подготовить аудиоисторию." }}
    </div>

    <div
      v-else-if="isOffline && !story?.audio"
      class="mt-3"
    >
      <OfflineUnavailable
        feature="ai-story"
        label="AI-история"
        icon="tabler:sparkles"
        variant="inline"
        reason="Сгенерируем, когда появится сеть"
      />
    </div>

    <div
      v-else
      class="mt-3 space-y-3"
    >
      <div class="h-1.5 overflow-hidden rounded-full bg-[var(--explore-surface-hover)]">
        <div
          class="h-full rounded-full bg-brand-gold transition-all"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="flex items-center gap-2">
        <button
          class="explore-primary-button inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canUseStory || state.status === 'loading' || state.status === 'generating'"
          type="button"
          @click="handlePrimaryAction"
        >
          <Icon
            :class="{ 'animate-spin': state.status === 'generating' }"
            :name="primaryIcon"
            size="16"
          />
          <span>{{ primaryLabel }}</span>
        </button>

        <button
          v-if="story?.audio"
          aria-label="Повторить историю"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--explore-border)] bg-[var(--explore-surface-soft)] text-[var(--explore-text-muted)] transition hover:bg-[var(--explore-surface-hover)]"
          type="button"
          @click="placeStory.replay(request)"
        >
          <Icon
            name="tabler:rotate-clockwise"
            size="16"
          />
        </button>
      </div>

      <div
        v-if="story?.audio"
        class="flex items-center justify-between gap-2 rounded-md bg-[var(--explore-surface-soft)] px-2 py-2"
      >
        <span class="min-w-0 truncate text-[11px] font-medium text-[var(--explore-text-muted)]">{{ offlineLabel }}</span>
        <button
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-brand-gold/25 px-2 text-[11px] font-bold text-brand-gold transition hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="state.offlineStatus === 'saving' || state.offlineStatus === 'removing' || state.offlineStatus === 'unsupported'"
          type="button"
          @click="handleOfflineAction"
        >
          <Icon
            :class="{ 'animate-spin': state.offlineStatus === 'saving' || state.offlineStatus === 'removing' }"
            :name="state.offlineStatus === 'saved' ? 'tabler:trash' : 'tabler:download'"
            size="14"
          />
          <span>{{ state.offlineStatus === "saved" ? "Удалить" : "Сохранить" }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
