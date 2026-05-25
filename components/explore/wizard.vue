<script lang="ts" setup>
import type { ExploreInterest } from "~/lib/explore/context";
import type { ExploreCitySuggestion, SelectedExploreCity } from "~/lib/explore/search";

type Step = "city" | "days" | "interests" | "generate";

const STEPS: Step[] = ["city", "days", "interests", "generate"];
const DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14];
const INTERESTS: Array<{ icon: string; label: string; value: ExploreInterest }> = [
  { icon: "tabler:building-arch", label: "Культура", value: "culture" },
  { icon: "tabler:tools-kitchen-2", label: "Еда", value: "food" },
  { icon: "tabler:leaf", label: "Природа", value: "nature" },
  { icon: "tabler:mountain", label: "Приключения", value: "adventure" },
  { icon: "tabler:palette", label: "Искусство", value: "art" },
  { icon: "tabler:moon-stars", label: "Ночная жизнь", value: "nightlife" },
  { icon: "tabler:shopping-bag", label: "Шопинг", value: "shopping" },
  { icon: "tabler:sparkles", label: "Скрытые места", value: "hidden-gems" },
];

const {
  requestContext,
  selectedCity,
  selectedDays,
  selectedInterests,
  setSelectedCity,
  toggleInterest,
} = useExploreContext();
const aiRouteSession = useAiRouteSession();

const stepIndex = ref(0);
const slideDirection = ref<"forward" | "back">("forward");
const editing = ref(false);

const showRouteSession = computed(() => Boolean(
  aiRouteSession.sessionId.value
  || aiRouteSession.isGenerating.value
  || aiRouteSession.activePoints.value.length,
));
const collapsed = computed(() => showRouteSession.value && !editing.value);
const currentStep = computed<Step>(() => STEPS[stepIndex.value] ?? "city");

// Mobile: when the wizard is expanded over an active route, the route step
// carousel occupies the bottom of the screen. Lift the wizard above it so the
// "Куда едем?" input does not overlap the place scroll. 200px is a safe
// fallback until the carousel reports its measured height.
const carouselHeight = useState<number>("explore-route-carousel-height", () => 0);
const expandedBottomPx = computed(() =>
  showRouteSession.value ? (carouselHeight.value || 200) + 12 : 88,
);

const interestsSummary = computed(() => {
  if (!selectedInterests.value.length)
    return "Интересы не выбраны";
  return selectedInterests.value
    .map(value => INTERESTS.find(item => item.value === value)?.label ?? value)
    .join(", ");
});

const firstInterestLabel = computed(() => {
  const first = selectedInterests.value[0];
  if (!first)
    return null;
  return INTERESTS.find(item => item.value === first)?.label ?? null;
});

watch(showRouteSession, (next) => {
  if (next)
    editing.value = false;
});

function goToStep(target: number) {
  const clamped = Math.max(0, Math.min(STEPS.length - 1, target));
  slideDirection.value = clamped >= stepIndex.value ? "forward" : "back";
  stepIndex.value = clamped;
}

function next() {
  goToStep(stepIndex.value + 1);
}

function back() {
  goToStep(stepIndex.value - 1);
}

function expand() {
  editing.value = true;
  stepIndex.value = 0;
  slideDirection.value = "back";
}

// City typeahead (inline)
const query = ref(selectedCity.value?.label || "");
const suggestions = ref<ExploreCitySuggestion[]>([]);
const cityLoading = ref(false);
const cityError = ref("");
const activeSuggestionIndex = ref(-1);
const dropdownOpen = computed(() => Boolean(query.value.trim())
  && (suggestions.value.length > 0 || cityLoading.value || Boolean(cityError.value)));

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const sessionToken = createSessionToken();

watch(query, (nextQuery) => {
  if (nextQuery === selectedCity.value?.label)
    return;

  if (debounceTimer)
    clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    void loadSuggestions(nextQuery);
  }, 250);
});

watch(selectedCity, (city) => {
  if (city)
    query.value = city.label;
});

onBeforeUnmount(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer);
});

async function loadSuggestions(nextQuery: string) {
  const normalized = nextQuery.trim();
  suggestions.value = [];
  activeSuggestionIndex.value = -1;
  cityError.value = "";

  if (normalized.length < 2)
    return;

  cityLoading.value = true;
  try {
    suggestions.value = await $fetch<ExploreCitySuggestion[]>("/api/explore/city-suggest", {
      query: { q: normalized, sessionToken },
    });
  }
  catch {
    cityError.value = "Поиск городов недоступен";
  }
  finally {
    cityLoading.value = false;
  }
}

async function selectSuggestion(suggestion: ExploreCitySuggestion) {
  cityError.value = "";
  cityLoading.value = true;
  try {
    const city = await retrieveCity(suggestion);
    if (!city)
      throw new Error("Missing city coordinates");

    setSelectedCity(city);
    query.value = city.label;
    suggestions.value = [];
    next();
  }
  catch {
    cityError.value = "Не удалось выбрать этот город";
  }
  finally {
    cityLoading.value = false;
  }
}

function selectActiveSuggestion() {
  const suggestion = suggestions.value[activeSuggestionIndex.value] || suggestions.value[0];
  if (suggestion)
    void selectSuggestion(suggestion);
}

function moveActiveSuggestion(direction: number) {
  if (!suggestions.value.length)
    return;
  const len = suggestions.value.length;
  activeSuggestionIndex.value = (activeSuggestionIndex.value + direction + len) % len;
}

async function retrieveCity(suggestion: ExploreCitySuggestion) {
  if (suggestion.provider === "mapbox") {
    return await $fetch<SelectedExploreCity>("/api/explore/city-retrieve", {
      query: { provider: suggestion.provider, providerId: suggestion.providerId, sessionToken },
    });
  }
  return await $fetch<SelectedExploreCity>("/api/explore/city-retrieve", {
    query: {
      provider: suggestion.provider,
      providerId: suggestion.providerId,
      label: suggestion.label,
      name: suggestion.name,
      lat: suggestion.coordinates?.lat,
      long: suggestion.coordinates?.long,
    },
  });
}

function createSessionToken() {
  if (import.meta.client && "crypto" in window && "randomUUID" in window.crypto)
    return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function pickDay(day: number) {
  selectedDays.value = day;
  next();
}

async function generate() {
  if (!selectedCity.value || aiRouteSession.isGenerating.value)
    return;
  await aiRouteSession.generateRoute(requestContext.value);
}

// Mobile swipe
let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;
const SWIPE_THRESHOLD = 40;

function onTouchStart(event: TouchEvent) {
  if (dropdownOpen.value)
    return;
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, button, [role='listbox']"))
    return;
  const touch = event.touches[0];
  if (!touch)
    return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchActive = true;
}

function onTouchEnd(event: TouchEvent) {
  if (!touchActive)
    return;
  touchActive = false;
  const touch = event.changedTouches[0];
  if (!touch)
    return;
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx))
    return;
  if (dx < 0)
    next();
  else
    back();
}
</script>

<template>
  <div
    class="pointer-events-none absolute z-[60] transition-all"
    :style="{ '--explore-wizard-bottom': `${expandedBottomPx}px` }"
    :class="collapsed && showRouteSession
      ? 'left-3 right-3 top-[120px] md:bottom-6 md:left-1/2 md:right-auto md:top-auto md:w-[min(96vw,520px)] md:-translate-x-1/2'
      : 'bottom-[var(--explore-wizard-bottom)] left-1/2 w-[min(96vw,520px)] -translate-x-1/2 md:bottom-6'"
  >
    <Transition name="badge" mode="out-in">
      <button
        v-if="collapsed"
        key="badge"
        aria-label="Изменить параметры маршрута"
        class="explore-wizard-badge pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur-md transition"
        type="button"
        @click="expand"
      >
        <Icon
          class="explore-wizard-accent-icon"
          name="tabler:map-pin"
          size="16"
        />
        <span class="explore-text truncate">{{ selectedCity?.label || "Выберите город" }}</span>
        <span class="explore-text-faint">·</span>
        <span class="explore-text whitespace-nowrap">{{ selectedDays }} дн.</span>
        <template v-if="firstInterestLabel">
          <span class="explore-text-faint">·</span>
          <span class="explore-text-soft truncate max-md:max-w-[20vw]">{{ firstInterestLabel }}</span>
        </template>
        <span class="explore-text-faint max-md:hidden">·</span>
        <span class="explore-text-soft truncate max-md:hidden">{{ interestsSummary }}</span>
        <Icon
          class="explore-text-faint ml-1"
          name="tabler:pencil"
          size="14"
        />
      </button>

      <div
        v-else
        key="wizard"
        class="explore-wizard-shell pointer-events-auto rounded-full border backdrop-blur-md"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div class="relative flex h-12 items-center px-2">
          <button
            v-if="stepIndex > 0"
            aria-label="Назад"
            class="explore-wizard-nav-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
            type="button"
            @click="back"
          >
            <Icon name="tabler:chevron-left" size="18" />
          </button>
          <div v-else class="w-8 shrink-0" />

          <div class="relative min-w-0 flex-1 overflow-hidden">
            <Transition :name="slideDirection === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">
              <div :key="currentStep" class="flex h-12 items-center">
                <!-- City -->
                <div v-if="currentStep === 'city'" class="relative flex w-full items-center px-1">
                  <Icon
                    class="explore-text-faint absolute left-2"
                    name="tabler:map-pin-search"
                    size="16"
                  />
                  <input
                    v-model="query"
                    aria-autocomplete="list"
                    :aria-expanded="dropdownOpen"
                    autocomplete="off"
                    class="explore-wizard-input w-full rounded-full bg-transparent px-8 py-2 text-sm outline-none"
                    placeholder="Куда едем?"
                    type="search"
                    @keydown.down.prevent="moveActiveSuggestion(1)"
                    @keydown.up.prevent="moveActiveSuggestion(-1)"
                    @keydown.enter.prevent="selectActiveSuggestion"
                  >
                  <Icon
                    v-if="cityLoading"
                    class="explore-text-faint absolute right-2 animate-spin"
                    name="tabler:loader-2"
                    size="16"
                  />
                </div>

                <!-- Days -->
                <div v-else-if="currentStep === 'days'" class="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto px-2">
                  <button
                    v-for="day in DAY_OPTIONS"
                    :key="day"
                    class="h-8 min-w-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition"
                    :class="selectedDays === day ? 'explore-primary-button' : 'explore-chip'"
                    type="button"
                    @click="pickDay(day)"
                  >
                    {{ day }} дн.
                  </button>
                </div>

                <!-- Interests -->
                <div v-else-if="currentStep === 'interests'" class="no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto px-2">
                  <button
                    v-for="interest in INTERESTS"
                    :key="interest.value"
                    class="flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition"
                    :class="selectedInterests.includes(interest.value) ? 'explore-chip-active' : 'explore-chip'"
                    type="button"
                    @click="toggleInterest(interest.value)"
                  >
                    <Icon :name="interest.icon" size="13" />
                    <span>{{ interest.label }}</span>
                  </button>
                </div>

                <!-- Generate -->
                <div v-else-if="currentStep === 'generate'" class="flex w-full items-center justify-between gap-2 px-2">
                  <div class="explore-text-soft min-w-0 flex-1 text-xs">
                    <div class="explore-text truncate font-semibold">
                      {{ selectedCity?.label || "Сначала выберите город" }}
                    </div>
                    <div class="truncate">
                      {{ selectedDays }} дн. · {{ interestsSummary }}
                    </div>
                  </div>
                  <button
                    class="explore-primary-button flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="aiRouteSession.isGenerating.value || !selectedCity"
                    type="button"
                    @click="generate"
                  >
                    <Icon
                      v-if="aiRouteSession.isGenerating.value"
                      class="animate-spin"
                      name="tabler:loader-2"
                      size="14"
                    />
                    <Icon
                      v-else
                      name="tabler:sparkles"
                      size="14"
                    />
                    <span>{{ aiRouteSession.activePoints.value.length ? "Перегенерировать" : "Сгенерировать" }}</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <button
            v-if="currentStep === 'interests'"
            aria-label="Далее"
            class="explore-primary-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
            type="button"
            @click="next"
          >
            <Icon name="tabler:chevron-right" size="18" />
          </button>
          <div v-else class="w-8 shrink-0" />
        </div>

        <!-- Progress dots -->
        <div class="flex items-center justify-center gap-1 pb-1.5">
          <button
            v-for="(_, index) in STEPS"
            :key="index"
            :aria-label="`Перейти к шагу ${index + 1}`"
            class="explore-wizard-dot h-1.5 rounded-full transition-all"
            :class="index === stepIndex ? 'explore-wizard-dot-active w-4' : 'w-1.5'"
            type="button"
            @click="goToStep(index)"
          />
        </div>

        <!-- City suggestions dropdown -->
        <div
          v-if="currentStep === 'city' && dropdownOpen"
          class="explore-popover absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-2xl border"
          role="listbox"
        >
          <button
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.id"
            class="explore-wizard-suggestion flex w-full flex-col px-3 py-2 text-left transition"
            :class="index === activeSuggestionIndex ? 'explore-wizard-suggestion-active' : ''"
            type="button"
            @click="selectSuggestion(suggestion)"
          >
            <span class="explore-text text-sm font-semibold">{{ suggestion.name }}</span>
            <span class="explore-text-soft truncate text-xs">{{ suggestion.description || suggestion.label }}</span>
          </button>
          <div
            v-if="!cityLoading && !suggestions.length && !cityError"
            class="explore-text-soft px-3 py-2 text-sm"
          >
            No city matches yet
          </div>
          <div
            v-if="cityError"
            class="px-3 py-2 text-sm"
            style="color: var(--explore-danger-text)"
          >
            {{ cityError }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}

.explore-wizard-badge {
  background: var(--explore-surface);
  color: var(--explore-text);
  border-color: var(--explore-border);
  box-shadow: 0 12px 32px var(--explore-shadow);
}
.explore-wizard-badge:hover {
  background: var(--explore-surface-strong);
}

.explore-wizard-shell {
  background: var(--explore-surface);
  border-color: var(--explore-border);
  box-shadow: 0 16px 40px var(--explore-overlay-shadow);
}

.explore-wizard-accent-icon {
  color: var(--explore-accent-strong);
}

.explore-wizard-nav-button {
  color: var(--explore-text-soft);
}
.explore-wizard-nav-button:hover {
  background: var(--explore-surface-hover);
  color: var(--explore-text);
}

.explore-wizard-input {
  color: var(--explore-text);
}
.explore-wizard-input::placeholder {
  color: var(--explore-text-faint);
}

.explore-wizard-dot {
  background: var(--explore-border-strong);
}
.explore-wizard-dot:hover {
  background: var(--explore-text-soft);
}
.explore-wizard-dot-active {
  background: var(--explore-text);
}

.explore-wizard-suggestion:hover,
.explore-wizard-suggestion-active {
  background: var(--explore-surface-active);
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 250ms ease,
    opacity 250ms ease;
}
.slide-left-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-right-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

.badge-enter-active,
.badge-leave-active {
  transition:
    transform 200ms ease,
    opacity 200ms ease;
}
.badge-enter-from,
.badge-leave-to {
  transform: scale(0.96);
  opacity: 0;
}
</style>
