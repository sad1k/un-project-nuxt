<script lang="ts" setup>
import {
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

type PopoverKey = "weather" | "history" | "followUp" | "share";

const { requestContext, selectedCity } = useExploreContext();
const aiRouteSession = useAiRouteSession();
const routeWeatherTips = useRouteWeatherTips();
const route = useRoute();

const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));

const showRouteSession = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));

const activeVariant = computed(() => aiRouteSession.variants.value.find(
  variant => variant.id === aiRouteSession.activeVariantId.value,
) ?? null);
const diarySave = computed(() => activeVariant.value?.diarySave ?? null);

const diaryLabel = computed(() => {
  if (!activeVariant.value || activeVariant.value.status !== "completed")
    return null;
  if (!diarySave.value)
    return "0/0";
  return `${diarySave.value.savedCount}/${diarySave.value.expectedPointCount}`;
});

const diaryToneClasses = computed(() => {
  const status = diarySave.value?.status;
  if (status === "saved")
    return "explore-diary-pill-success";
  if (status === "partial")
    return "explore-diary-pill-warning";
  if (status === "failed")
    return "explore-diary-pill-danger";
  return "explore-diary-pill-neutral";
});

const openPopover = ref<PopoverKey | null>(null);
const shareStatus = ref<"idle" | "copied" | "error">("idle");
const shareUrl = computed(() => {
  if (!aiRouteSession.sessionId.value)
    return "";
  if (import.meta.client)
    return `${window.location.origin}/explore?sessionId=${aiRouteSession.sessionId.value}`;
  return `/explore?sessionId=${aiRouteSession.sessionId.value}`;
});

watch(
  [selectedRoutePoints, () => requestContext.value.selectedDays, selectedCity],
  ([points, selectedDays, city]) => {
    void routeWeatherTips.loadWeatherTips({
      points,
      selectedDays,
      cityLabel: city?.label,
    });
  },
  { immediate: true },
);

watch(() => route.query.sessionId, () => {
  openPopover.value = null;
});

function toggle(key: PopoverKey) {
  openPopover.value = openPopover.value === key ? null : key;
  if (key === "share")
    shareStatus.value = "idle";
}

function close() {
  openPopover.value = null;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target)
    return;
  if (target.closest("[data-results-actions]"))
    return;
  close();
}

function onDocumentKey(event: KeyboardEvent) {
  if (event.key === "Escape")
    close();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKey);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onDocumentKey);
});

async function share() {
  if (!shareUrl.value) {
    shareStatus.value = "error";
    return;
  }

  const shareData = {
    title: "Route on WanderLog",
    text: selectedCity.value?.label ? `Route in ${selectedCity.value.label}` : "Travel route",
    url: shareUrl.value,
  };

  if (import.meta.client && typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      shareStatus.value = "copied";
      return;
    }
    catch {
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl.value);
    shareStatus.value = "copied";
  }
  catch {
    shareStatus.value = "error";
  }
}
</script>

<template>
  <div
    v-if="showRouteSession"
    class="pointer-events-auto flex items-center gap-2"
    data-results-actions
  >
    <span
      v-if="diaryLabel"
      class="flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold backdrop-blur-md transition"
      :class="diaryToneClasses"
    >
      <Icon
        :name="diarySave?.status === 'failed' ? 'tabler:alert-triangle' : 'tabler:bookmarks'"
        size="14"
      />
      <span>{{ diaryLabel }}</span>
    </span>

    <div class="relative">
      <button
        aria-label="Weather"
        class="explore-results-button flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition"
        :class="openPopover === 'weather' ? 'explore-results-button-active' : ''"
        type="button"
        @click="toggle('weather')"
      >
        <Icon name="tabler:cloud-rain" size="16" />
      </button>
      <Transition name="pop">
        <div
          v-if="openPopover === 'weather'"
          class="explore-popover scroll-thin z-40 overflow-y-auto overscroll-contain rounded-xl border p-3 max-md:fixed max-md:inset-x-3 max-md:bottom-[96px] max-md:left-3 max-md:right-auto max-md:top-auto max-md:max-h-[60vh] max-md:w-auto max-md:max-w-none md:absolute md:right-0 md:top-full md:mt-2 md:max-h-[calc(100vh-8rem)] md:w-80"
        >
          <ExploreRouteWeatherTips
            :error="routeWeatherTips.error.value"
            :status="routeWeatherTips.status.value"
            :tips="routeWeatherTips.tips.value"
          />
        </div>
      </Transition>
    </div>

    <div class="relative">
      <button
        aria-label="History"
        class="explore-results-button flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition"
        :class="openPopover === 'history' ? 'explore-results-button-active' : ''"
        type="button"
        @click="toggle('history')"
      >
        <Icon name="tabler:history" size="16" />
      </button>
      <Transition name="pop">
        <div
          v-if="openPopover === 'history'"
          class="explore-popover z-40 max-h-96 overflow-y-auto rounded-xl border p-3 max-md:fixed max-md:inset-x-3 max-md:bottom-[96px] max-md:top-auto max-md:right-auto max-md:left-3 max-md:w-auto max-md:max-w-none max-md:max-h-[60vh] max-md:overflow-y-auto md:absolute md:right-0 md:top-full md:mt-2 md:w-80"
        >
          <ExploreRouteHistory @select="close" />
        </div>
      </Transition>
    </div>

    <div class="relative">
      <button
        aria-label="Follow-up"
        class="explore-results-button flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition"
        :class="openPopover === 'followUp' ? 'explore-results-button-active' : ''"
        type="button"
        @click="toggle('followUp')"
      >
        <Icon name="tabler:message-circle" size="16" />
      </button>
      <Transition name="pop">
        <div
          v-if="openPopover === 'followUp'"
          class="explore-popover z-40 rounded-xl border p-3 max-md:fixed max-md:inset-x-3 max-md:bottom-[96px] max-md:top-auto max-md:right-auto max-md:left-3 max-md:w-auto max-md:max-w-none max-md:max-h-[60vh] max-md:overflow-y-auto md:absolute md:right-0 md:top-full md:mt-2 md:w-80"
        >
          <ExploreRouteFollowUp />
        </div>
      </Transition>
    </div>

    <div class="relative">
      <button
        aria-label="Share"
        class="explore-results-button flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition"
        :class="openPopover === 'share' ? 'explore-results-button-active' : ''"
        type="button"
        @click="toggle('share')"
      >
        <Icon name="tabler:share" size="16" />
      </button>
      <Transition name="pop">
        <div
          v-if="openPopover === 'share'"
          class="explore-popover z-40 rounded-xl border p-3 max-md:fixed max-md:inset-x-3 max-md:bottom-[96px] max-md:top-auto max-md:right-auto max-md:left-3 max-md:w-auto max-md:max-w-none max-md:max-h-[60vh] max-md:overflow-y-auto md:absolute md:right-0 md:top-full md:mt-2 md:w-72"
        >
          <div class="explore-text-soft mb-2 text-xs font-semibold">
            Share route
          </div>
          <div class="flex items-center gap-2">
            <input
              :value="shareUrl"
              class="explore-input min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs"
              readonly
              type="text"
            >
            <button
              class="explore-primary-button flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-semibold transition disabled:opacity-50"
              :disabled="!shareUrl"
              type="button"
              @click="share"
            >
              <Icon name="tabler:copy" size="13" />
              <span>{{ shareStatus === "copied" ? "Copied" : "Copy" }}</span>
            </button>
          </div>
          <p
            v-if="shareStatus === 'error'"
            class="mt-2 text-xs"
            style="color: var(--explore-danger-text)"
          >
            Could not copy link
          </p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.explore-results-button {
  background: var(--explore-surface);
  border-color: var(--explore-border);
  color: var(--explore-text-muted);
  box-shadow: 0 4px 12px var(--explore-shadow);
}
.explore-results-button:hover {
  background: var(--explore-surface-strong);
  color: var(--explore-text);
}
.explore-results-button-active {
  background: var(--explore-surface-active);
  color: var(--explore-accent-strong);
  border-color: color-mix(in srgb, var(--explore-accent-strong) 35%, transparent);
}

.explore-diary-pill-neutral {
  background: var(--explore-surface);
  border-color: var(--explore-border);
  color: var(--explore-text-soft);
}
.explore-diary-pill-success {
  background: var(--explore-success-bg);
  border-color: var(--explore-success-border);
  color: var(--explore-success-text);
}
.explore-diary-pill-warning {
  background: var(--explore-warning-bg);
  border-color: var(--explore-warning-border);
  color: var(--explore-warning-text);
}
.explore-diary-pill-danger {
  background: var(--explore-danger-bg);
  border-color: var(--explore-danger-border);
  color: var(--explore-danger-text);
}

.pop-enter-active,
.pop-leave-active {
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}
.pop-enter-from,
.pop-leave-to {
  transform: translateY(-4px) scale(0.96);
  opacity: 0;
}
</style>
