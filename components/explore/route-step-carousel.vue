<script lang="ts" setup>
import {
  filterRoutePointsByDay,
  toRouteMapPoints,
} from "~/lib/explore/route-map";

const aiRouteSession = useAiRouteSession();
const selectedDay = useState<number | null>("explore-selected-route-day", () => null);
const _selectedStoryRoutePointId = useState<string | null>("explore-selected-story-route-point-id", () => null);

const routeMapPoints = computed(() => toRouteMapPoints(aiRouteSession.activePoints.value));
const selectedRoutePoints = computed(() => filterRoutePointsByDay(routeMapPoints.value, selectedDay.value));

const showCarousel = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));
</script>

<template>
  <section
    v-if="showCarousel"
    class="route-step-carousel pointer-events-auto fixed inset-x-0 bottom-[80px] z-30 md:hidden"
    data-testid="explore-route-step-carousel"
  >
    <div class="px-3 py-2 text-xs">
      <!-- scaffold: {{ selectedRoutePoints.length }} stops -->
      stops: {{ selectedRoutePoints.length }}
    </div>
  </section>
</template>
