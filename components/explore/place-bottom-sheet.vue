<script setup lang="ts">
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{
  place: RouteMapPoint | null;
  intelligence: PlaceIntelligence | null;
  // Granular per-section flags (photo vs details), forwarded as-is to ExplorePlaceDetail.
  loading: { details?: boolean; photo?: boolean };
  editable?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
  story: [point: RouteMapPoint];
  edit: [point: RouteMapPoint];
  delete: [point: RouteMapPoint];
}>();

const SNAP_POINTS_SVH = [16, 52, 88] as const;
const SHEET_MIN_PX = 80;
const VELOCITY_SWIPE_THRESHOLD = 0.6;
const VELOCITY_DISMISS_THRESHOLD = 0.9;
const TAP_THRESHOLD_PX = 6;
const TAP_THRESHOLD_MS = 200;

const { isOffline } = useOnline();

const isOpen = computed(() => Boolean(props.place));
const currentSnap = ref(1);
const dragOffset = ref(0);
const isDragging = ref(false);
const viewportHeight = ref(800);

const baseHeightPx = computed(() => {
  return Math.round((SNAP_POINTS_SVH[currentSnap.value] / 100) * viewportHeight.value);
});

const heightPx = computed(() => {
  const target = baseHeightPx.value - dragOffset.value;
  return Math.max(SHEET_MIN_PX, Math.min(viewportHeight.value - 12, target));
});

let touchStartY = 0;
let touchStartHeight = 0;
let touchStartTime = 0;

function readViewportHeight() {
  if (typeof window === "undefined")
    return;
  viewportHeight.value = window.visualViewport?.height ?? window.innerHeight;
}

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0];
  if (!touch)
    return;
  touchStartY = touch.clientY;
  touchStartHeight = heightPx.value;
  touchStartTime = Date.now();
  isDragging.value = true;
  dragOffset.value = 0;
}

function onTouchMove(event: TouchEvent) {
  if (!isDragging.value)
    return;
  const touch = event.touches[0];
  if (!touch)
    return;
  dragOffset.value = touch.clientY - touchStartY;
}

function onTouchEnd() {
  if (!isDragging.value)
    return;
  isDragging.value = false;

  const elapsed = Math.max(1, Date.now() - touchStartTime);
  const draggedPx = -dragOffset.value;
  const velocity = draggedPx / elapsed;
  const heightAtRelease = touchStartHeight + draggedPx;
  dragOffset.value = 0;

  // Treat tiny still-position release as a tap on the handle: cycle to next snap.
  if (Math.abs(draggedPx) < TAP_THRESHOLD_PX && elapsed < TAP_THRESHOLD_MS) {
    const next = (currentSnap.value + 1) % SNAP_POINTS_SVH.length;
    currentSnap.value = next;
    return;
  }

  // Strong downward swipe past the smallest snap closes the sheet.
  const minSnapPx = (SNAP_POINTS_SVH[0] / 100) * viewportHeight.value;
  if (velocity < -VELOCITY_DISMISS_THRESHOLD && heightAtRelease < minSnapPx) {
    emit("close");
    return;
  }

  if (velocity > VELOCITY_SWIPE_THRESHOLD) {
    currentSnap.value = Math.min(SNAP_POINTS_SVH.length - 1, currentSnap.value + 1);
    return;
  }
  if (velocity < -VELOCITY_SWIPE_THRESHOLD) {
    if (currentSnap.value === 0) {
      emit("close");
      return;
    }
    currentSnap.value = Math.max(0, currentSnap.value - 1);
    return;
  }

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  SNAP_POINTS_SVH.forEach((snap, index) => {
    const snapPx = (snap / 100) * viewportHeight.value;
    const distance = Math.abs(heightAtRelease - snapPx);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  currentSnap.value = nearestIndex;
}

watch(isOpen, (next) => {
  if (next) {
    currentSnap.value = 1;
    dragOffset.value = 0;
    readViewportHeight();
  }
});

onMounted(() => {
  readViewportHeight();
  window.visualViewport?.addEventListener("resize", readViewportHeight);
  window.addEventListener("resize", readViewportHeight);
});

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener("resize", readViewportHeight);
  window.removeEventListener("resize", readViewportHeight);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="place-sheet">
      <section
        v-if="isOpen"
        class="explore-popover place-bottom-sheet fixed inset-x-0 bottom-0 z-[70] flex flex-col overflow-hidden rounded-t-2xl border md:hidden"
        :style="{
          height: `${heightPx}px`,
          transition: isDragging ? 'none' : 'height 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        }"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="flex h-8 shrink-0 cursor-grab items-center justify-center touch-none active:cursor-grabbing"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        >
          <span
            class="h-1.5 w-10 rounded-full"
            style="background-color: var(--explore-border-strong)"
          />
        </div>

        <ExplorePlaceDetail
          class="min-h-0 flex-1"
          :place="place"
          :intelligence="intelligence"
          :loading="loading"
          :editable="editable"
          @save="emit('save', $event)"
          @directions="emit('directions', $event)"
          @story="emit('story', $event)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />

        <div
          v-if="isOffline"
          class="shrink-0 px-3 pb-2 pt-1"
        >
          <OfflineUnavailable
            feature="ai-story"
            label="AI-история"
            icon="tabler:sparkles"
            variant="inline"
            reason="Сгенерируем, когда появится сеть"
          />
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.place-bottom-sheet {
  background: var(--explore-surface-strong);
  color: var(--explore-text);
  border-color: var(--explore-border);
  box-shadow: 0 -16px 40px var(--explore-overlay-shadow);
  padding-bottom: env(safe-area-inset-bottom);
}

.place-sheet-enter-active,
.place-sheet-leave-active {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.place-sheet-enter-from,
.place-sheet-leave-to {
  transform: translateY(100%);
}
</style>
