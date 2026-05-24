<script setup lang="ts">
const mapStore = useMapStore();
const hasMounted = ref(false);

watch(() => mapStore.mobileSheetState, (s) => {
  if (s !== "collapsed" && !hasMounted.value)
    hasMounted.value = true;
});

const heightClass = computed(() => {
  switch (mapStore.mobileSheetState) {
    case "collapsed": return "h-12";
    case "peek": return "h-[60svh]";
    case "expanded": return "h-[calc(100svh-8rem-env(safe-area-inset-bottom))]";
    default: return "h-12";
  }
});

function toggleCollapse() { mapStore.toggleMobileSheet(); }
function expandFull() { mapStore.mobileSheetState = "expanded"; }
function shrinkToPeek() { mapStore.mobileSheetState = "peek"; }

const counterLabel = computed(() => {
  const n = mapStore.mapPoints?.length;
  return typeof n === "number" && n > 0 ? `📍 ${n} мест на карте` : "Карта";
});
</script>

<template>
  <aside
    class="app-chrome-strong fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-y shadow-2xl motion-safe:transition-[height] motion-safe:duration-250 md:hidden"
    :class="heightClass"
    aria-label="Карта мест"
  >
    <button
      type="button"
      class="flex h-12 w-full items-center justify-between px-4 text-sm font-medium"
      :aria-expanded="mapStore.mobileSheetState !== 'collapsed'"
      :aria-label="mapStore.mobileSheetState === 'collapsed' ? 'Раскрыть карту' : 'Свернуть карту'"
      @click="toggleCollapse"
    >
      <span class="flex items-center gap-2">
        <Icon name="tabler:map-2" size="18" />
        {{ counterLabel }}
      </span>
      <span v-if="mapStore.mobileSheetState !== 'collapsed'" class="flex gap-1">
        <button
          v-if="mapStore.mobileSheetState === 'peek'"
          type="button"
          class="app-chrome-control flex h-8 w-8 items-center justify-center rounded-md border"
          aria-label="Развернуть карту на весь экран"
          @click.stop="expandFull"
        >
          <Icon name="tabler:chevron-up" size="16" />
        </button>
        <button
          v-if="mapStore.mobileSheetState === 'expanded'"
          type="button"
          class="app-chrome-control flex h-8 w-8 items-center justify-center rounded-md border"
          aria-label="Уменьшить карту"
          @click.stop="shrinkToPeek"
        >
          <Icon name="tabler:chevron-down" size="16" />
        </button>
      </span>
    </button>
    <div
      v-if="hasMounted"
      v-show="mapStore.mobileSheetState !== 'collapsed'"
      class="h-[calc(100%-3rem)] overflow-hidden"
    >
      <AppYndxMap class="h-full w-full" />
    </div>
  </aside>
</template>
