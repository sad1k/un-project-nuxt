<script lang="ts" setup>
type GlobalSearchItem = {
  description: string | null;
  icon: string;
  id: string;
  kind: "place" | "route" | "user";
  meta: string;
  title: string;
  to: string;
};

type GlobalSearchGroup = {
  items: GlobalSearchItem[];
  key: "places" | "routes" | "users";
  label: string;
};

type GlobalSearchResponse = {
  cta: {
    description: string;
    icon: string;
    title: string;
    to: string;
  };
  groups: GlobalSearchGroup[];
  query: string;
};

const query = ref("");
const open = ref(false);
const loading = ref(false);
const error = ref("");
const groups = ref<GlobalSearchGroup[]>([]);
const activeIndex = ref(0);
const searchRoot = ref<HTMLElement | null>(null);
const latestRequestId = ref(0);
let debounceId: ReturnType<typeof setTimeout> | null = null;

const exploreCta = {
  description: "Откройте Explore и соберите маршрут под дни, интересы и темп поездки",
  icon: "tabler:sparkles",
  title: "Сгенерировать маршрут",
  to: "/explore",
};

const trimmedQuery = computed(() => query.value.trim());
const visibleGroups = computed(() => groups.value.filter(group => group.items.length > 0));
const flatItems = computed(() => visibleGroups.value.flatMap(group => group.items));
const hasResults = computed(() => flatItems.value.length > 0);
const totalSelectableCount = computed(() => flatItems.value.length + 1);

watch(trimmedQuery, () => {
  activeIndex.value = 0;

  if (debounceId)
    clearTimeout(debounceId);

  if (!trimmedQuery.value) {
    groups.value = [];
    loading.value = false;
    error.value = "";
    return;
  }

  loading.value = true;
  debounceId = setTimeout(() => {
    void runSearch();
  }, 180);
});

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  if (debounceId)
    clearTimeout(debounceId);

  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});

async function runSearch() {
  const requestId = latestRequestId.value + 1;
  latestRequestId.value = requestId;

  try {
    const response = await $fetch<GlobalSearchResponse>("/api/search/global", {
      query: {
        limit: 4,
        q: trimmedQuery.value,
      },
    });

    if (requestId !== latestRequestId.value)
      return;

    groups.value = response.groups;
    error.value = "";
  }
  catch {
    if (requestId !== latestRequestId.value)
      return;

    groups.value = [];
    error.value = "Не удалось загрузить результаты";
  }
  finally {
    if (requestId === latestRequestId.value)
      loading.value = false;
  }
}

function onFocus() {
  open.value = true;

  if (trimmedQuery.value && !groups.value.length && !loading.value)
    void runSearch();
}

function closeSearch() {
  open.value = false;
  activeIndex.value = 0;
}

function clearSearch() {
  query.value = "";
  groups.value = [];
  error.value = "";
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!searchRoot.value?.contains(event.target as Node))
    closeSearch();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    open.value = true;
    searchRoot.value?.querySelector("input")?.focus();
  }
}

function moveActive(step: number) {
  open.value = true;
  activeIndex.value = (activeIndex.value + step + totalSelectableCount.value) % totalSelectableCount.value;
}

async function selectActiveResult() {
  const selectedItem = activeIndex.value === 0
    ? null
    : flatItems.value[activeIndex.value - 1];

  await navigateTo(selectedItem?.to ?? exploreCta.to);
  closeSearch();
}

function getResultIcon(item: GlobalSearchItem) {
  return item.kind === "user" && item.icon.startsWith("http") ? null : item.icon;
}
</script>

<template>
  <div
    ref="searchRoot"
    class="relative min-w-0"
    role="search"
  >
    <form
      class="app-chrome-control group flex h-10 min-w-0 items-center gap-2 rounded-full border px-3 text-left text-[13px] shadow-2xl backdrop-blur-xl transition-all duration-300 focus-within:border-brand-gold/45"
      @submit.prevent="selectActiveResult"
    >
      <Icon
        class="app-chrome-faint shrink-0 transition duration-300 group-focus-within:text-brand-gold group-hover:scale-110"
        name="tabler:search"
        size="16"
      />
      <input
        v-model="query"
        aria-label="Поиск"
        class="app-chrome-text min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-chrome-text-faint)]"
        placeholder="Искать места, маршруты, людей..."
        type="search"
        @focus="onFocus"
        @keydown.down.prevent="moveActive(1)"
        @keydown.esc.prevent="closeSearch"
        @keydown.up.prevent="moveActive(-1)"
      >
      <button
        v-if="query"
        aria-label="Очистить поиск"
        class="app-chrome-faint grid h-6 w-6 shrink-0 place-items-center rounded-md transition hover:bg-[var(--app-chrome-control-hover)] hover:text-[var(--app-chrome-text)]"
        type="button"
        @click="clearSearch"
      >
        <Icon name="tabler:x" size="14" />
      </button>
      <span v-else class="app-chrome-faint hidden rounded border border-[var(--app-chrome-border)] px-1.5 py-0.5 font-mono text-[10px] md:inline">
        Ctrl K
      </span>
    </form>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="app-chrome-strong absolute left-0 right-0 top-12 z-50 max-h-[min(70vh,560px)] overflow-hidden rounded-lg border p-2 backdrop-blur-2xl"
      >
        <NuxtLink
          :class="activeIndex === 0 ? 'border-brand-gold/45 bg-brand-gold/15' : 'border-brand-gold/20 bg-brand-gold/10 hover:border-brand-gold/45 hover:bg-brand-gold/15'"
          :to="exploreCta.to"
          class="mb-2 flex items-center gap-3 rounded-lg border p-3 text-left transition"
          @click="closeSearch"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-gold text-brand-dark shadow-lg shadow-brand-gold/20">
            <Icon :name="exploreCta.icon" size="20" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="app-chrome-text block text-sm font-semibold">{{ exploreCta.title }}</span>
            <span class="app-chrome-muted mt-0.5 block text-xs leading-5">{{ exploreCta.description }}</span>
          </span>
          <Icon
            class="app-chrome-faint shrink-0"
            name="tabler:arrow-up-right"
            size="17"
          />
        </NuxtLink>

        <div class="max-h-[calc(min(70vh,560px)-88px)] overflow-y-auto pr-1">
          <div v-if="loading" class="flex items-center gap-2 px-3 py-4 text-sm app-chrome-muted">
            <span class="loading loading-spinner loading-sm text-brand-gold" />
            Ищем совпадения...
          </div>

          <div v-else-if="error" class="px-3 py-4 text-sm text-rose-400">
            {{ error }}
          </div>

          <template v-else-if="trimmedQuery && hasResults">
            <section
              v-for="group in visibleGroups"
              :key="group.key"
              class="py-1"
            >
              <p class="app-chrome-faint px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                {{ group.label }}
              </p>
              <NuxtLink
                v-for="item in group.items"
                :key="item.id"
                :class="activeIndex === flatItems.findIndex(result => result.id === item.id) + 1 ? 'bg-[var(--app-chrome-control-hover)] text-[var(--app-chrome-text)]' : 'hover:bg-[var(--app-chrome-control-hover)]'"
                :to="item.to"
                class="app-chrome-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition"
                @click="closeSearch"
              >
                <span class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--app-chrome-control-bg)] text-brand-gold">
                  <img
                    v-if="item.kind === 'user' && item.icon.startsWith('http')"
                    :alt="item.title"
                    :src="item.icon"
                    class="h-full w-full object-cover"
                  >
                  <Icon
                    v-else
                    :name="getResultIcon(item) || 'tabler:user-circle'"
                    size="18"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="app-chrome-text block truncate text-sm font-medium">{{ item.title }}</span>
                  <span class="app-chrome-faint block truncate text-xs">{{ item.meta }}</span>
                  <span v-if="item.description" class="app-chrome-muted mt-0.5 block truncate text-xs">
                    {{ item.description }}
                  </span>
                </span>
                <Icon
                  class="app-chrome-faint shrink-0"
                  name="tabler:chevron-right"
                  size="16"
                />
              </NuxtLink>
            </section>
          </template>

          <div v-else-if="trimmedQuery" class="px-3 py-5 text-center">
            <p class="app-chrome-text text-sm font-medium">
              Ничего не найдено
            </p>
            <p class="app-chrome-muted mt-1 text-xs">
              Попробуйте другое место, пользователя или маршрут.
            </p>
          </div>

          <div v-else class="px-3 py-4 text-sm app-chrome-muted">
            Начните вводить название места, маршрута или пользователя.
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
