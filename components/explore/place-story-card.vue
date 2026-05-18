<script lang="ts" setup>
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{
  point: RouteMapPoint | null;
  sessionId: number | null;
  variantId: number | null;
}>();

const placeStory = usePlaceStory();
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
    return "Preparing story";

  if (state.value.status === "playing")
    return "Pause";

  if (state.value.status === "paused")
    return "Resume";

  if (state.value.status === "ended")
    return "Replay";

  if (story.value?.audio)
    return "Play";

  return "Listen to story";
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
    return "Available offline";

  if (state.value.offlineStatus === "saving")
    return "Saving";

  if (state.value.offlineStatus === "removing")
    return "Removing";

  if (state.value.offlineStatus === "unavailable_offline")
    return "Story not saved offline";

  if (state.value.offlineStatus === "unsupported")
    return "Offline save unavailable";

  return "Not saved offline";
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
    class="rounded-lg border border-amber-100 bg-amber-50/80 p-3"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase text-amber-700">
          Place story
        </p>
        <h3 class="mt-1 truncate text-sm font-bold text-gray-900">
          {{ story?.title || point.name }}
        </h3>
      </div>
      <span class="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-amber-700">
        Day {{ point.day }}
      </span>
    </div>

    <p class="mt-2 text-xs leading-5 text-gray-600">
      {{ story?.sourceNote || "Based on sourced place data and route context." }}
    </p>
    <p class="mt-1 text-[11px] text-gray-500">
      {{ story?.disclosure || "Audio narration is AI-generated." }}
    </p>

    <div
      v-if="state.status === 'unavailable' || state.offlineStatus === 'unavailable_offline'"
      class="mt-3 rounded-md bg-white px-3 py-2 text-xs text-gray-600"
    >
      {{ state.offlineStatus === "unavailable_offline" ? "Story not saved offline." : "Story unavailable until more sourced place facts are available." }}
    </div>

    <div
      v-else-if="state.status === 'error'"
      class="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      {{ state.error || "Story audio could not be prepared." }}
    </div>

    <div
      v-else
      class="mt-3 space-y-3"
    >
      <div class="h-1.5 overflow-hidden rounded-full bg-white">
        <div
          class="h-full rounded-full bg-amber-500 transition-all"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="flex items-center gap-2">
        <button
          class="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          aria-label="Replay story"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-gray-700 transition hover:bg-amber-100"
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
        class="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-2"
      >
        <span class="min-w-0 truncate text-[11px] font-medium text-gray-600">{{ offlineLabel }}</span>
        <button
          class="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-200 px-2 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="state.offlineStatus === 'saving' || state.offlineStatus === 'removing' || state.offlineStatus === 'unsupported'"
          type="button"
          @click="handleOfflineAction"
        >
          <Icon
            :class="{ 'animate-spin': state.offlineStatus === 'saving' || state.offlineStatus === 'removing' }"
            :name="state.offlineStatus === 'saved' ? 'tabler:trash' : 'tabler:download'"
            size="14"
          />
          <span>{{ state.offlineStatus === "saved" ? "Remove" : "Save" }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
