<script lang="ts" setup>
const locationStore = useLocationStore();
const { locations, locationsStatus: status } = storeToRefs(locationStore);

const searchQuery = ref("");
const sortOrder = ref<"recent" | "name">("recent");

const sortOptions = [
  { value: "recent" as const, label: "Недавние" },
  { value: "name" as const, label: "А–Я" },
];

const hasLocations = computed(() => (locations.value?.length ?? 0) > 0);
const isPending = computed(() => status.value === "pending");

const filteredLocations = computed(() => {
  const list = locations.value ?? [];
  const q = searchQuery.value.trim().toLowerCase();
  const filtered = q
    ? list.filter(l =>
        l.name.toLowerCase().includes(q)
        || (l.description ?? "").toLowerCase().includes(q),
      )
    : list;
  return [...filtered].sort((a, b) => {
    if (sortOrder.value === "name")
      return a.name.localeCompare(b.name, "ru");
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
});

const stats = computed(() => {
  const list = locations.value ?? [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return {
    total: list.length,
    recent: list.filter(l => (l.createdAt ?? 0) >= now - sevenDays).length,
    latest: list.reduce((acc, l) => Math.max(acc, l.createdAt ?? 0), 0),
  };
});

function pluralizeRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19)
    return many;
  if (mod10 === 1)
    return one;
  if (mod10 >= 2 && mod10 <= 4)
    return few;
  return many;
}

function formatRelative(ts: number): string {
  if (!ts)
    return "—";
  const diff = Date.now() - ts;
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days < 1)
    return "сегодня";
  if (days === 1)
    return "вчера";
  if (days < 7)
    return `${days} ${pluralizeRu(days, "день", "дня", "дней")} назад`;
  if (days < 30)
    return `${Math.floor(days / 7)} нед. назад`;
  if (days < 365)
    return `${Math.floor(days / 30)} мес. назад`;
  return `${Math.floor(days / 365)} ${pluralizeRu(Math.floor(days / 365), "год", "года", "лет")} назад`;
}

onMounted(() => {
  locationStore.locationsRefresh();
});

onBeforeRouteLeave((to) => {
  if (to.name !== "dashboard-location-slug") {
    locationStore.locationsRefresh();
  }
});
</script>

<template>
  <div class="page-content-top px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:mb-5">
      <div>
        <p class="mb-2 font-mono text-xs uppercase tracking-[0.28em] text-brand-gold/70">
          WanderLog
        </p>
        <h2 class="text-2xl font-display tracking-tight text-gray-950 sm:text-3xl dark:text-white">
          Твои сохранённые места
        </h2>
        <div
          v-if="hasLocations"
          class="mt-3 flex flex-wrap items-center gap-2 text-sm"
        >
          <span class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
            <Icon
              name="tabler:map-pin"
              size="14"
              class="text-brand-gold"
            />
            <span class="font-semibold">{{ stats.total }}</span>
            <span class="opacity-70">{{ pluralizeRu(stats.total, "место", "места", "мест") }}</span>
          </span>
          <span
            v-if="stats.recent > 0"
            class="inline-flex items-center gap-1.5 rounded-full border border-brand-emerald/30 bg-brand-emerald/10 px-3 py-1 text-brand-emerald dark:text-emerald-300"
          >
            <Icon name="tabler:sparkles" size="14" />
            <span>+{{ stats.recent }} за неделю</span>
          </span>
          <span
            v-if="stats.latest"
            class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
          >
            <Icon
              name="tabler:clock"
              size="14"
              class="text-brand-gold"
            />
            <span>{{ formatRelative(stats.latest) }}</span>
          </span>
        </div>
      </div>
      <NuxtLink
        class="btn w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/20 transition active:scale-[0.98] hover:bg-teal-500 sm:w-auto"
        to="/dashboard/place-photo/new"
      >
        <Icon name="tabler:camera-plus" size="20" />
        Быстрое фото
      </NuxtLink>
    </div>

    <div
      v-if="hasLocations && !isPending"
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <label class="relative flex-1">
        <Icon
          name="tabler:search"
          size="18"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Поиск по названию или описанию"
          aria-label="Поиск по местам"
          class="h-11 w-full rounded-xl border border-gray-200 bg-white/70 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-gold/60 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
        >
      </label>
      <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <div
          class="flex items-center gap-1 rounded-xl border border-gray-200 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5"
          role="radiogroup"
          aria-label="Сортировка"
        >
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="sortOrder === opt.value"
            :class="sortOrder === opt.value
              ? 'bg-brand-gold/20 text-brand-gold'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            @click="sortOrder = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <NuxtLink
          to="/explore"
          class="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 text-sm text-gray-700 transition hover:border-brand-gold/40 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white"
        >
          <Icon name="tabler:map" size="18" />
          <span>На карте</span>
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="isPending"
      class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Загрузка мест"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="flex w-full items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 motion-safe:animate-pulse md:flex-col md:gap-0 md:p-0 dark:border-white/10 dark:bg-white/5"
      >
        <div class="h-[72px] w-[72px] shrink-0 rounded-xl bg-gray-200/70 md:h-32 md:w-full md:rounded-b-none md:rounded-t-2xl dark:bg-white/10" />
        <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 md:p-3">
          <div class="h-4 w-2/3 rounded bg-gray-200/70 dark:bg-white/10" />
          <div class="h-3 w-4/5 rounded bg-gray-200/50 dark:bg-white/[0.06]" />
        </div>
      </div>
    </div>
    <div
      v-else-if="filteredLocations.length > 0"
      class="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3"
    >
      <LocationCard
        v-for="location in filteredLocations"
        :key="location.id"
        :map-point="createMapPointFromLocation(location)"
      />
    </div>
    <div
      v-else-if="hasLocations"
      class="flex flex-col items-center gap-3 py-12 text-center"
    >
      <Icon
        name="tabler:search-off"
        size="40"
        class="text-gray-400 dark:text-gray-500"
      />
      <p class="text-gray-600 dark:text-gray-400">
        Ничего не найдено по «{{ searchQuery }}».
      </p>
      <button
        type="button"
        class="text-sm text-brand-gold underline-offset-4 hover:underline"
        @click="searchQuery = ''"
      >
        Сбросить поиск
      </button>
    </div>
    <div
      v-else
      class="flex flex-col items-stretch gap-4 sm:items-start"
    >
      <p class="font-light text-gray-600 dark:text-gray-400">
        Добавьте место, чтобы начать сохранять воспоминания.
      </p>
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <NuxtLink
          class="btn w-full border-none bg-brand-gold font-bold text-brand-dark hover:bg-white sm:w-auto sm:min-w-[160px]"
          to="/dashboard/place-photo/new"
        >
          <Icon name="tabler:camera-plus" size="24" />
          Быстрое фото
        </NuxtLink>
        <NuxtLink
          class="btn btn-outline w-full border-brand-emerald text-brand-emerald hover:border-brand-emerald hover:bg-brand-emerald hover:text-white sm:w-auto"
          to="/explore"
        >
          <Icon name="tabler:compass" size="20" />
          Исследовать карту
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
