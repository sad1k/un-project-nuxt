<script lang="ts" setup>
const { isEditMode, toggleEditMode, setEditMode } = useRouteEditMode();
const aiRouteSession = useAiRouteSession();
const { setAddMode } = useUserRoutePoints();

const activePoints = aiRouteSession.activePoints;
const isGenerating = aiRouteSession.isGenerating;
const count = computed(() => activePoints.value.length);
const pendingClear = ref(false);

function onToggle() {
  if (!isEditMode.value)
    setAddMode(false); // mutual exclusion
  toggleEditMode();
}

function requestClear() {
  pendingClear.value = true;
}

function cancelClear() {
  pendingClear.value = false;
}

async function executeClear() {
  pendingClear.value = false;
  await aiRouteSession.clearActivePoints();
  setEditMode(false);
}
</script>

<template>
  <div
    v-if="count > 0"
    class="pointer-events-auto flex flex-col items-start gap-2"
  >
    <Transition name="edit-panel">
      <div
        v-if="isEditMode"
        class="explore-popover w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-sm font-semibold">
            <Icon
              class="text-brand-gold"
              name="tabler:route"
              size="16"
            />
            Редактирование маршрута
          </span>
          <span class="explore-text-soft text-xs font-medium">{{ count }}</span>
        </div>

        <p class="explore-text-soft mt-1 text-xs leading-snug">
          Перетащите точку, нажмите для правки или удалите ненужные
        </p>

        <div
          v-if="pendingClear"
          class="mt-3 rounded-lg border p-2.5"
          style="border-color: var(--explore-border)"
        >
          <p class="explore-text-soft mb-2 text-xs leading-snug">
            Удалить все точки маршрута?
          </p>
          <div class="flex items-center gap-2">
            <button
              class="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
              style="border-color: var(--explore-border); color: var(--explore-danger-text)"
              type="button"
              @click="executeClear"
            >
              Удалить
            </button>
            <button
              class="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
              style="border-color: var(--explore-border); color: var(--explore-text-muted)"
              type="button"
              @click="cancelClear"
            >
              Отмена
            </button>
          </div>
        </div>

        <div
          v-else
          class="mt-3 flex items-center gap-2"
        >
          <button
            class="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
            style="border-color: var(--explore-border); color: var(--explore-text-muted)"
            type="button"
            @click="setEditMode(false)"
          >
            <Icon name="tabler:check" size="14" />
            Готово
          </button>
          <button
            class="flex h-8 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
            style="border-color: var(--explore-border); color: var(--explore-danger-text)"
            :disabled="isGenerating"
            type="button"
            @click="requestClear"
          >
            <Icon name="tabler:eraser" size="14" />
            Очистить всё
          </button>
        </div>
      </div>
    </Transition>

    <button
      :aria-pressed="isEditMode"
      class="explore-control flex h-10 items-center gap-2 rounded-xl border px-3 shadow-lg backdrop-blur-xl transition"
      :class="isEditMode ? 'text-brand-gold' : 'hover:text-brand-gold'"
      :style="isEditMode ? 'border-color: color-mix(in srgb, var(--color-brand-gold) 45%, transparent)' : ''"
      :disabled="isGenerating"
      type="button"
      @click="onToggle"
    >
      <Icon name="tabler:pencil" size="16" />
      <span class="text-xs font-semibold">{{ isEditMode ? "Редактирование…" : "Редактировать маршрут" }}</span>
      <span
        v-if="count"
        class="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
        style="background: var(--explore-marker-ai)"
      >{{ count }}</span>
    </button>
  </div>
</template>

<style scoped>
.edit-panel-enter-active,
.edit-panel-leave-active {
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}
.edit-panel-enter-from,
.edit-panel-leave-to {
  transform: translateY(6px) scale(0.97);
  opacity: 0;
}
</style>
