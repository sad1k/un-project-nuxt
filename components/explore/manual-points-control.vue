<script lang="ts" setup>
const {
  userPoints,
  isAddMode,
  toggleAddMode,
  removeUserPoint,
  clearUserPoints,
  setAddMode,
  toAnchorPoint,
  buildAnchorCity,
} = useUserRoutePoints();
const { setEditMode } = useRouteEditMode();
const aiRouteSession = useAiRouteSession();
const exploreContext = useExploreContext();

function handleToggleAddMode() {
  setEditMode(false);
  toggleAddMode();
}

const count = computed(() => userPoints.value.length);
const isGenerating = aiRouteSession.isGenerating;
const wish = ref("");

const hasActiveRoute = computed(() => Boolean(
  aiRouteSession.sessionId.value && aiRouteSession.activeVariantId.value,
));

// Enabled whenever there is at least one manual stop: an existing route is
// refined, otherwise a fresh route is generated around the points themselves.
const canComplete = computed(() => Boolean(count.value && !isGenerating.value));

const completeHint = computed(() => {
  if (!count.value)
    return "";
  if (isGenerating.value)
    return "Ассистент строит маршрут…";
  if (hasActiveRoute.value)
    return "ИИ впишет ваши точки в текущий маршрут и добавит места по пути";
  if (exploreContext.selectedCity.value)
    return "ИИ проложит маршрут через ваши точки и добавит места по пути";
  return "ИИ проложит маршрут через ваши точки и добавит места по пути";
});

function formatCoords(point: { lat: number; lng: number }) {
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

// The anchor points travel as structured context; this message carries the
// behaviour reminder plus the user's optional free-text wish.
function buildAssistantMessage(extraWish: string) {
  const base = "Проложи маршрут через мои опорные точки (переданы в anchorPoints) — обязательно зайди в каждую. Не просто соединяй их: добавь интересные места по пути между ними и рядом, по моим интересам, с минимальным крюком.";
  const trimmed = extraWish.trim();
  return trimmed ? `${base}\nДополнительно: ${trimmed}` : base;
}

async function completeWithAssistant() {
  if (!canComplete.value)
    return;

  const message = buildAssistantMessage(wish.value);
  const anchorPoints = userPoints.value.map(toAnchorPoint);
  let produced = false;

  if (hasActiveRoute.value) {
    const variantCountBefore = aiRouteSession.variants.value.length;
    // Merge the freshly placed anchors into the stored request context so the
    // refined variant routes through them too.
    await aiRouteSession.submitFollowUp(message, { anchorPoints });
    // A follow-up no-ops silently if the session context is missing; only treat
    // it as done when the assistant actually emitted a fresh variant.
    produced = aiRouteSession.variants.value.length > variantCountBefore;
  }
  else {
    const base = exploreContext.requestContext.value;
    await aiRouteSession.generateRoute(
      {
        ...base,
        // Fall back to a region anchor derived from the points so generation
        // works even when no city was chosen.
        city: base.city ?? buildAnchorCity(),
        anchorPoints,
      },
      { followUpMessage: wish.value },
    );
    produced = aiRouteSession.activePoints.value.length > 0;
  }

  // The assistant now owns these stops — drop the manual markers so they do not
  // duplicate the generated route, and close the editor.
  if (produced && !aiRouteSession.error.value) {
    clearUserPoints();
    setAddMode(false);
    wish.value = "";
  }
}
</script>

<template>
  <div class="pointer-events-auto flex flex-col items-start gap-2">
    <Transition name="manual-panel">
      <div
        v-if="isAddMode"
        class="explore-popover w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-sm font-semibold">
            <Icon
              class="text-brand-gold"
              name="tabler:map-pin-plus"
              size="16"
            />
            Свои точки
          </span>
          <span class="explore-text-soft text-xs font-medium">{{ count }}</span>
        </div>

        <p class="explore-text-soft mt-1 text-xs leading-snug">
          Кликните по карте, чтобы добавить опорную точку. ИИ проложит маршрут через них и добавит интересные места по пути.
        </p>

        <ul
          v-if="count"
          class="scroll-thin mt-2 max-h-48 space-y-1 overflow-y-auto pr-1"
        >
          <li
            v-for="(point, index) in userPoints"
            :key="point.id"
            class="flex items-center gap-2 rounded-lg border px-2 py-1.5"
            style="border-color: var(--explore-border); background: var(--explore-surface)"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style="background: var(--explore-marker-user)"
            >{{ index + 1 }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold">{{ point.name }}</span>
              <span class="explore-text-soft block truncate text-[10px]">{{ formatCoords(point) }}</span>
            </span>
            <button
              :aria-label="`Удалить ${point.name}`"
              class="explore-text-soft shrink-0 rounded-md p-1 transition hover:text-[var(--explore-danger-text)]"
              type="button"
              @click="removeUserPoint(point.id)"
            >
              <Icon name="tabler:trash" size="14" />
            </button>
          </li>
        </ul>

        <div class="mt-3">
          <label
            class="explore-text-soft mb-1 block text-[11px] font-semibold"
            for="manual-points-wish"
          >
            Дополнительно спросить у ИИ
          </label>
          <textarea
            id="manual-points-wish"
            v-model="wish"
            class="explore-input scroll-thin w-full resize-none rounded-lg border px-2.5 py-2 text-xs leading-snug transition focus:border-brand-gold/50"
            :disabled="isGenerating"
            data-testid="explore-manual-points-wish"
            placeholder="напр. добавь уютные кофейни и смотровые по пути"
            rows="2"
          />
        </div>

        <div class="mt-3 space-y-2">
          <button
            class="explore-primary-button flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canComplete"
            :title="completeHint || undefined"
            type="button"
            @click="completeWithAssistant"
          >
            <Icon
              :class="isGenerating ? 'animate-spin' : ''"
              :name="isGenerating ? 'tabler:loader-2' : 'tabler:sparkles'"
              size="15"
            />
            {{ isGenerating ? "Ассистент строит…" : "Дополнить с ИИ" }}
          </button>

          <p
            v-if="completeHint && !isGenerating"
            class="explore-text-soft text-[10px] leading-snug"
          >
            {{ completeHint }}
          </p>

          <div class="flex items-center gap-2">
            <button
              class="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
              style="border-color: var(--explore-border); color: var(--explore-text-muted)"
              type="button"
              @click="setAddMode(false)"
            >
              <Icon name="tabler:check" size="14" />
              Готово
            </button>
            <button
              v-if="count"
              class="flex h-8 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
              style="border-color: var(--explore-border); color: var(--explore-text-muted)"
              type="button"
              @click="clearUserPoints"
            >
              <Icon name="tabler:eraser" size="14" />
              Очистить
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <button
      :aria-pressed="isAddMode"
      class="explore-control flex h-10 items-center gap-2 rounded-xl border px-3 shadow-lg backdrop-blur-xl transition"
      :class="isAddMode ? 'text-brand-gold' : 'hover:text-brand-gold'"
      :style="isAddMode ? 'border-color: color-mix(in srgb, var(--color-brand-gold) 45%, transparent)' : ''"
      data-testid="explore-manual-points-toggle"
      type="button"
      @click="handleToggleAddMode"
    >
      <Icon name="tabler:map-pin-plus" size="16" />
      <span class="text-xs font-semibold">{{ isAddMode ? "Добавление точек" : "Свои точки" }}</span>
      <span
        v-if="count"
        class="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
        style="background: var(--explore-marker-user)"
      >{{ count }}</span>
    </button>
  </div>
</template>

<style scoped>
.manual-panel-enter-active,
.manual-panel-leave-active {
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}
.manual-panel-enter-from,
.manual-panel-leave-to {
  transform: translateY(6px) scale(0.97);
  opacity: 0;
}
</style>
