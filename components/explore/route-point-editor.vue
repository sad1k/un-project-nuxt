<script lang="ts" setup>
import type { RoutePointPatch } from "~/lib/ai/route-contract";
import type { RouteMapPoint } from "~/lib/explore/route-map";

const props = defineProps<{ point: RouteMapPoint }>();
const emit = defineEmits<{ submit: [patch: RoutePointPatch]; cancel: [] }>();

const name = ref(props.point.name);
const day = ref(props.point.day);
const estimatedStart = ref("");
const estimatedDurationMinutes = ref<number | null>(props.point.estimatedDurationMinutes ?? null);
const rationale = ref(props.point.rationale ?? "");

function buildPatch(): RoutePointPatch {
  const patch: RoutePointPatch = {};
  if (name.value.trim() && name.value !== props.point.name)
    patch.name = name.value.trim();
  if (day.value && day.value !== props.point.day)
    patch.day = day.value;
  if (estimatedStart.value.trim())
    patch.estimatedStart = estimatedStart.value.trim();
  if (estimatedDurationMinutes.value !== null && estimatedDurationMinutes.value !== props.point.estimatedDurationMinutes)
    patch.estimatedDurationMinutes = estimatedDurationMinutes.value;
  if (rationale.value.trim() && rationale.value !== props.point.rationale)
    patch.rationale = rationale.value.trim();
  return patch;
}

function onSubmit() {
  const patch = buildPatch();
  if (Object.keys(patch).length)
    emit("submit", patch);
  else
    emit("cancel");
}
</script>

<template>
  <form
    class="space-y-2"
    @submit.prevent="onSubmit"
  >
    <div>
      <label class="explore-text-soft block text-[11px] font-semibold mb-1" for="rpe-name">Название</label>
      <input
        id="rpe-name"
        v-model="name"
        class="explore-input w-full rounded-lg border px-2.5 py-2 text-xs transition focus:border-brand-gold/50"
        type="text"
        maxlength="160"
      >
    </div>

    <div class="flex gap-2">
      <div class="flex-1">
        <label class="explore-text-soft block text-[11px] font-semibold mb-1" for="rpe-start">Время начала</label>
        <input
          id="rpe-start"
          v-model="estimatedStart"
          class="explore-input w-full rounded-lg border px-2.5 py-2 text-xs transition focus:border-brand-gold/50"
          placeholder="10:30"
          type="text"
          maxlength="40"
        >
      </div>
      <div class="w-20">
        <label class="explore-text-soft block text-[11px] font-semibold mb-1" for="rpe-day">День</label>
        <input
          id="rpe-day"
          v-model.number="day"
          class="explore-input w-full rounded-lg border px-2.5 py-2 text-xs transition focus:border-brand-gold/50"
          type="number"
          min="1"
          max="14"
        >
      </div>
    </div>

    <div>
      <label class="explore-text-soft block text-[11px] font-semibold mb-1" for="rpe-duration">Длительность (мин)</label>
      <input
        id="rpe-duration"
        v-model.number="estimatedDurationMinutes"
        class="explore-input w-full rounded-lg border px-2.5 py-2 text-xs transition focus:border-brand-gold/50"
        type="number"
        min="15"
        max="720"
      >
    </div>

    <div>
      <label class="explore-text-soft block text-[11px] font-semibold mb-1" for="rpe-rationale">Описание</label>
      <textarea
        id="rpe-rationale"
        v-model="rationale"
        class="explore-input scroll-thin w-full resize-none rounded-lg border px-2.5 py-2 text-xs leading-snug transition focus:border-brand-gold/50"
        rows="2"
        maxlength="500"
      />
    </div>

    <div class="flex gap-2 pt-1">
      <button
        class="explore-primary-button flex h-8 flex-1 items-center justify-center rounded-lg text-xs font-semibold transition"
        type="submit"
      >
        Сохранить
      </button>
      <button
        class="flex h-8 flex-1 items-center justify-center rounded-lg border text-xs font-semibold transition"
        style="border-color: var(--explore-border); color: var(--explore-text-muted)"
        type="button"
        @click="emit('cancel')"
      >
        Отмена
      </button>
    </div>
  </form>
</template>
