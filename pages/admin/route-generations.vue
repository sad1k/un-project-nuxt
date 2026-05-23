<script lang="ts" setup>
type AdminRouteStatus = "generating" | "completed" | "failed";
type AdminFailureStage = "validation" | "provider" | "parsing" | "persistence" | "diary_save" | "notification" | "unknown";

type AdminRouteGenerationSummary = {
  activeVariantId: number | null;
  cityName: string | null;
  createdAt: number;
  diarySave: {
    expectedPointCount: number;
    failedCount: number;
    pendingCount: number;
    savedCount: number;
    status: "pending" | "saved" | "partial" | "failed";
  } | null;
  displayStatus: AdminRouteStatus | "stale";
  failureCode: string | null;
  failureStage: AdminFailureStage;
  generationCompletedAt: number | null;
  generationHeartbeatAt: number | null;
  generationStartedAt: number | null;
  notificationStatus: string;
  pointCount: number;
  provider: string | null;
  providerModel: string | null;
  requestSummary: {
    candidatePlaceCount: number;
    cityName: string | null;
    currentLocationEnabled: boolean;
    days: number | null;
    diaryLogCount: number;
    interests: string[];
    savedPlaceCount: number;
  };
  retryability: string;
  retryCount: number;
  safeExplanation: string;
  sessionId: number;
  status: AdminRouteStatus;
  title: string | null;
  updateAt: number;
  user: {
    email: string;
    id: number;
    name: string;
  };
  variantId: number | null;
};

const FAILURE_STAGES: Array<AdminFailureStage | ""> = ["", "validation", "provider", "parsing", "persistence", "diary_save", "notification", "unknown"];
const STATUSES: Array<AdminRouteStatus | ""> = ["", "generating", "completed", "failed"];

const filters = reactive({
  failureCode: "",
  failureStage: "" as AdminFailureStage | "",
  limit: "50",
  status: "" as AdminRouteStatus | "",
});

const query = computed(() => ({
  failureCode: filters.failureCode || undefined,
  failureStage: filters.failureStage || undefined,
  limit: filters.limit || undefined,
  status: filters.status || undefined,
}));

const { data, error, pending, refresh } = await useFetch<{ generatedAt: number; sessions: AdminRouteGenerationSummary[] }>(
  "/api/admin/route-generations",
  {
    query,
    server: false,
    watch: false,
  },
);

const sessions = computed(() => data.value?.sessions ?? []);
const isForbidden = computed(() => getErrorStatus(error.value) === 403);
const failedSessions = computed(() => sessions.value.filter(session => session.status === "failed").length);
const staleSessions = computed(() => sessions.value.filter(session => session.displayStatus === "stale").length);
const completedSessions = computed(() => sessions.value.filter(session => session.status === "completed").length);

function applyFilters() {
  void refresh();
}

function getErrorStatus(input: unknown) {
  if (typeof input !== "object" || input === null)
    return null;

  const maybeError = input as { status?: number; statusCode?: number };
  return maybeError.statusCode ?? maybeError.status ?? null;
}

function formatDate(timestamp: number | null) {
  if (!timestamp)
    return "-";

  return new Intl.DateTimeFormat("ru", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatDuration(startedAt: number | null, completedAt: number | null) {
  if (!startedAt || !completedAt)
    return "-";

  const seconds = Math.max(0, Math.round((completedAt - startedAt) / 1000));
  if (seconds < 60)
    return `${seconds} с`;

  return `${Math.round(seconds / 60)} мин`;
}

function summarizeRequest(session: AdminRouteGenerationSummary) {
  const summary = session.requestSummary;
  const interests = summary.interests.length ? summary.interests.map(formatInterest).join(", ") : "нет";
  return `${summary.days ?? "-"} дн. - ${interests} - сохранено ${summary.savedPlaceCount} - дневник ${summary.diaryLogCount}`;
}

function statusClass(status: string) {
  if (status === "completed")
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";

  if (status === "failed")
    return "border-rose-300/25 bg-rose-400/10 text-rose-100";

  if (status === "stale")
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";

  return "border-sky-300/25 bg-sky-400/10 text-sky-100";
}

function userLabel(session: AdminRouteGenerationSummary) {
  return session.user.email || session.user.name || `user:${session.user.id}`;
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "готово",
    failed: "ошибка",
    generating: "генерируется",
    stale: "зависло",
  };

  return labels[status] || status;
}

function formatFailureStage(stage: string) {
  const labels: Record<string, string> = {
    diary_save: "дневник",
    notification: "уведомления",
    parsing: "разбор",
    persistence: "сохранение",
    provider: "провайдер",
    unknown: "неизвестно",
    validation: "валидация",
  };

  return labels[stage] || stage;
}

function formatInterest(interest: string) {
  const labels: Record<string, string> = {
    "adventure": "приключения",
    "art": "искусство",
    "culture": "культура",
    "family": "семья",
    "food": "еда",
    "hidden-gems": "скрытые места",
    "nature": "природа",
    "nightlife": "ночная жизнь",
    "shopping": "шопинг",
  };

  return labels[interest] || interest;
}

function formatDiaryStatus(status: string) {
  const labels: Record<string, string> = {
    failed: "ошибка",
    partial: "частично",
    pending: "ожидает",
    saved: "сохранено",
  };

  return labels[status] || status;
}
</script>

<template>
  <section class="admin-theme-page min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-6 text-gray-950 sm:px-6 lg:px-8 dark:bg-[#050505] dark:text-white">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header class="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="font-mono text-xs uppercase text-brand-gold/75">
            Админ / генерации маршрутов
          </p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Операции генерации маршрутов
          </h1>
        </div>

        <div class="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[360px]">
          <div class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <p class="text-white/45">
              Готово
            </p>
            <p class="text-lg font-semibold text-emerald-100">
              {{ completedSessions }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <p class="text-white/45">
              Ошибки
            </p>
            <p class="text-lg font-semibold text-rose-100">
              {{ failedSessions }}
            </p>
          </div>
          <div class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <p class="text-white/45">
              Зависло
            </p>
            <p class="text-lg font-semibold text-amber-100">
              {{ staleSessions }}
            </p>
          </div>
        </div>
      </header>

      <div
        v-if="isForbidden"
        class="rounded-lg border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100"
      >
        Нужна роль администратора.
      </div>

      <template v-else>
        <form class="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-2 xl:grid-cols-[160px_180px_minmax(0,1fr)_120px_auto]" @submit.prevent="applyFilters">
          <label class="flex flex-col gap-1 text-xs text-white/50">
            Статус
            <select v-model="filters.status" class="h-10 rounded-md border border-white/10 bg-[#101010] px-3 text-sm text-white">
              <option
                v-for="status in STATUSES"
                :key="status || 'all'"
                :value="status"
              >
                {{ status ? formatStatus(status) : "все" }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs text-white/50">
            Этап ошибки
            <select v-model="filters.failureStage" class="h-10 rounded-md border border-white/10 bg-[#101010] px-3 text-sm text-white">
              <option
                v-for="stage in FAILURE_STAGES"
                :key="stage || 'all'"
                :value="stage"
              >
                {{ stage ? formatFailureStage(stage) : "все" }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-xs text-white/50">
            Код ошибки
            <input
              v-model.trim="filters.failureCode"
              class="h-10 rounded-md border border-white/10 bg-[#101010] px-3 text-sm text-white"
              placeholder="provider_rate_limited"
            >
          </label>
          <label class="flex flex-col gap-1 text-xs text-white/50">
            Лимит
            <input
              v-model="filters.limit"
              class="h-10 rounded-md border border-white/10 bg-[#101010] px-3 text-sm text-white"
              inputmode="numeric"
            >
          </label>
          <button class="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-brand-gold/25 bg-brand-gold px-4 text-sm font-semibold text-brand-dark transition hover:bg-white md:col-span-2 xl:col-span-1" type="submit">
            <Icon name="tabler:filter" size="16" />
            Применить
          </button>
        </form>

        <div v-if="error && !isForbidden" class="rounded-lg border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          Не удалось загрузить сессии генерации маршрутов.
        </div>

        <div class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
          <div class="grid grid-cols-[110px_1.2fr_1.1fr_130px_1.2fr_150px_88px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase text-white/40 max-xl:hidden">
            <span>Статус</span>
            <span>Пользователь / город</span>
            <span>Запрос</span>
            <span>Время</span>
            <span>Ошибка</span>
            <span>Дневник / уведомления</span>
            <span>Детали</span>
          </div>

          <div v-if="pending" class="p-6 text-sm text-white/50">
            Загружаем сессии...
          </div>
          <div v-else-if="!sessions.length" class="p-6 text-sm text-white/50">
            Нет сессий генерации маршрутов под эти фильтры.
          </div>
          <div
            v-for="session in sessions"
            v-else
            :key="session.sessionId"
            class="grid gap-3 border-b border-white/5 px-4 py-4 text-sm last:border-b-0 xl:grid-cols-[110px_1.2fr_1.1fr_130px_1.2fr_150px_88px]"
          >
            <div>
              <span class="inline-flex rounded-md border px-2 py-1 text-xs font-semibold" :class="statusClass(session.displayStatus)">
                {{ formatStatus(session.displayStatus) }}
              </span>
              <p class="mt-2 text-xs text-white/45">
                #{{ session.sessionId }} / v{{ session.variantId || "-" }}
              </p>
            </div>

            <div class="min-w-0">
              <p class="truncate font-medium text-white">
                {{ userLabel(session) }}
              </p>
              <p class="truncate text-xs text-white/50">
                {{ session.cityName || session.requestSummary.cityName || "Неизвестный город" }}
              </p>
              <p class="mt-1 text-xs text-white/35">
                {{ formatDate(session.createdAt) }}
              </p>
            </div>

            <div class="min-w-0">
              <p class="truncate text-white/75">
                {{ summarizeRequest(session) }}
              </p>
              <p class="text-xs text-white/45">
                кандидаты {{ session.requestSummary.candidatePlaceCount }} · точки {{ session.pointCount }}
              </p>
            </div>

            <div class="text-xs text-white/55">
              <p>{{ formatDuration(session.generationStartedAt, session.generationCompletedAt) }}</p>
              <p>повтор {{ session.retryCount }}</p>
              <p>{{ formatDate(session.updateAt) }}</p>
            </div>

            <div class="min-w-0">
              <p class="text-xs text-white/45">
                {{ formatFailureStage(session.failureStage) }} / {{ session.failureCode || "нет" }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs text-white/65">
                {{ session.retryability }} · {{ session.safeExplanation }}
              </p>
            </div>

            <div class="text-xs text-white/55">
              <p>дневник {{ formatDiaryStatus(session.diarySave?.status || "pending") }}</p>
              <p>уведомления {{ session.notificationStatus }}</p>
              <p>провайдер {{ session.provider || "н/д" }}</p>
            </div>

            <NuxtLink class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:border-brand-gold/35 hover:text-brand-gold" :to="`/admin/route-generation-detail?sessionId=${session.sessionId}`">
              <Icon name="tabler:external-link" size="15" />
              Открыть
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
