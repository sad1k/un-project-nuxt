<script lang="ts" setup>
type AdminRouteDetail = {
  activeVariantId: number | null;
  cityName: string | null;
  createdAt: number;
  events: Array<{
    createdAt: number;
    sequence: number;
    type: string;
    validationStatus: string;
    variantId: number | null;
  }>;
  requestSummary: {
    candidatePlaceCount: number;
    cityName: string | null;
    currentLocationEnabled: boolean;
    days: number | null;
    diaryLogCount: number;
    interests: string[];
    savedPlaceCount: number;
  };
  sessionId: number;
  status: "generating" | "completed" | "failed";
  updateAt: number;
  user: {
    email: string;
    id: number;
    name: string;
  };
  variants: Array<{
    diarySave: {
      expectedPointCount: number;
      failedCount: number;
      pendingCount: number;
      savedCount: number;
      status: "pending" | "saved" | "partial" | "failed";
    } | null;
    failureCode: string | null;
    failureStage: string;
    generationCompletedAt: number | null;
    generationHeartbeatAt: number | null;
    generationStartedAt: number | null;
    id: number;
    notificationStatus: string;
    parentVariantId: number | null;
    pointCount: number;
    points: Array<{
      approximateDistanceMeters: number | null;
      confidence: string;
      coordinates: {
        lat: number;
        long: number;
      };
      day: number;
      estimatedDurationMinutes: number | null;
      estimatedPriceLevel: string | null;
      estimatedStart: string | null;
      name: string;
      priceConfidence: string | null;
      priceSource: string | null;
      routePointId: string;
      sequence: number;
    }>;
    retryability: string;
    retryCount: number;
    safeExplanation: string;
    status: string;
    summary: string | null;
    title: string | null;
  }>;
};

const route = useRoute();
const sessionId = computed(() => String(route.query.sessionId || ""));

const data = ref<AdminRouteDetail | null>(null);
const error = ref<unknown | null>(null);
const pending = ref(false);

const activeVariant = computed(() => data.value?.variants.find(variant => variant.id === data.value?.activeVariantId) ?? data.value?.variants[0] ?? null);
const isForbidden = computed(() => getErrorStatus(error.value) === 403);

onMounted(() => {
  void refresh();
});

watch(sessionId, () => {
  void refresh();
});

async function refresh() {
  if (!sessionId.value) {
    data.value = null;
    error.value = new Error("Не указан ID сессии генерации маршрута");
    return;
  }

  pending.value = true;
  error.value = null;

  try {
    data.value = await $fetch<AdminRouteDetail>(`/api/admin/route-generations/${sessionId.value}`);
  }
  catch (caughtError) {
    data.value = null;
    error.value = caughtError;
  }
  finally {
    pending.value = false;
  }
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

function formatCoord(value: number) {
  return value.toFixed(5);
}

function formatDistance(value: number | null) {
  if (!value)
    return "-";

  if (value < 1000)
    return `${value} м`;

  return `${(value / 1000).toFixed(1)} км`;
}

function userLabel(detail: AdminRouteDetail) {
  return detail.user.email || detail.user.name || `user:${detail.user.id}`;
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "готово",
    failed: "ошибка",
    generating: "генерируется",
    pending: "ожидает",
    partial: "частично",
    saved: "сохранено",
    stale: "зависло",
  };

  return labels[status] || status;
}

function formatConfidence(confidence: string | null) {
  const labels: Record<string, string> = {
    high: "высокая",
    low: "низкая",
    medium: "средняя",
  };

  return confidence ? labels[confidence] || confidence : "н/д";
}

function formatPrice(value: string | null) {
  const labels: Record<string, string> = {
    free: "бесплатно",
    high: "дорого",
    low: "недорого",
    medium: "средне",
    unknown: "неизвестно",
  };

  return value ? labels[value] || value : "стоимость н/д";
}

function formatFailureStage(stage: string | null | undefined) {
  const labels: Record<string, string> = {
    diary_save: "дневник",
    notification: "уведомления",
    parsing: "разбор",
    persistence: "сохранение",
    provider: "провайдер",
    unknown: "неизвестно",
    validation: "валидация",
  };

  return stage ? labels[stage] || stage : "неизвестно";
}
</script>

<template>
  <section class="admin-theme-page min-h-[calc(100vh-4rem)] bg-gray-50 px-4 py-6 text-gray-950 sm:px-6 lg:px-8 dark:bg-[#050505] dark:text-white">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <NuxtLink class="inline-flex w-fit items-center gap-2 text-sm text-white/55 transition hover:text-brand-gold" to="/admin/route-generations">
        <Icon name="tabler:arrow-left" size="16" />
        Генерации маршрутов
      </NuxtLink>

      <div
        v-if="isForbidden"
        class="rounded-lg border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100"
      >
        Нужна роль администратора.
      </div>

      <template v-else>
        <div v-if="pending" class="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm text-white/50">
          Загружаем детали генерации маршрута...
        </div>
        <div v-else-if="error || !data" class="rounded-lg border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          Не удалось загрузить детали генерации маршрута.
          <button
            class="ml-3 text-brand-gold underline"
            type="button"
            @click="refresh()"
          >
            Повторить
          </button>
        </div>

        <template v-else>
          <header class="grid gap-4 border-b border-white/10 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p class="font-mono text-xs uppercase text-brand-gold/75">
                Админ / генерация маршрута #{{ data.sessionId }}
              </p>
              <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                {{ activeVariant?.title || data.cityName || "Детали генерации маршрута" }}
              </h1>
              <p class="mt-2 max-w-3xl text-sm text-white/55">
                {{ activeVariant?.summary || activeVariant?.safeExplanation || "Сводка не записана." }}
              </p>
            </div>

            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
              <p>{{ userLabel(data) }}</p>
              <p class="text-white/40">
                {{ formatStatus(data.status) }} - обновлено {{ formatDate(data.updateAt) }}
              </p>
            </div>
          </header>

          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs uppercase text-white/40">
                Ошибка
              </p>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ formatFailureStage(activeVariant?.failureStage) }} / {{ activeVariant?.failureCode || "нет" }}
              </p>
              <p class="mt-1 text-xs text-white/55">
                {{ activeVariant?.retryability || "не применимо" }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs uppercase text-white/40">
                Запрос
              </p>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ data.requestSummary.days || "-" }} дн. - {{ data.requestSummary.interests.join(", ") || "без интересов" }}
              </p>
              <p class="mt-1 text-xs text-white/55">
                сохранено {{ data.requestSummary.savedPlaceCount }} - дневник {{ data.requestSummary.diaryLogCount }} - кандидаты {{ data.requestSummary.candidatePlaceCount }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs uppercase text-white/40">
                Сохранение в дневник
              </p>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ formatStatus(activeVariant?.diarySave?.status || "pending") }}
              </p>
              <p class="mt-1 text-xs text-white/55">
                сохранено {{ activeVariant?.diarySave?.savedCount || 0 }} - ошибок {{ activeVariant?.diarySave?.failedCount || 0 }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p class="text-xs uppercase text-white/40">
                Время
              </p>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ formatDate(activeVariant?.generationStartedAt || null) }}
              </p>
              <p class="mt-1 text-xs text-white/55">
                завершено {{ formatDate(activeVariant?.generationCompletedAt || null) }}
              </p>
            </div>
          </div>

          <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section class="rounded-lg border border-white/10 bg-white/[0.025]">
              <div class="border-b border-white/10 px-4 py-3">
                <h2 class="text-sm font-semibold text-white">
                  Очищенный снимок маршрута
                </h2>
              </div>
              <div class="divide-y divide-white/5">
                <div
                  v-for="point in activeVariant?.points || []"
                  :key="`${point.routePointId}:${point.sequence}`"
                  class="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[72px_1fr_180px_150px]"
                >
                  <div class="text-xs text-white/45">
                    <p>день {{ point.day }}</p>
                    <p>#{{ point.sequence }}</p>
                  </div>
                  <div>
                    <p class="font-medium text-white">
                      {{ point.name }}
                    </p>
                    <p class="mt-1 text-xs text-white/50">
                      уверенность: {{ formatConfidence(point.confidence) }} - {{ formatPrice(point.estimatedPriceLevel) }}
                    </p>
                  </div>
                  <div class="text-xs text-white/55">
                    <p>{{ formatCoord(point.coordinates.lat) }}, {{ formatCoord(point.coordinates.long) }}</p>
                    <p>{{ formatDistance(point.approximateDistanceMeters) }}</p>
                  </div>
                  <div class="text-xs text-white/55">
                    <p>{{ point.estimatedStart || "время н/д" }}</p>
                    <p>{{ point.estimatedDurationMinutes || "-" }} мин</p>
                  </div>
                </div>
                <div v-if="!activeVariant?.points.length" class="px-4 py-6 text-sm text-white/50">
                  Для этого варианта нет записанных точек маршрута.
                </div>
              </div>
            </section>

            <aside class="flex flex-col gap-5">
              <section class="rounded-lg border border-white/10 bg-white/[0.025]">
                <div class="border-b border-white/10 px-4 py-3">
                  <h2 class="text-sm font-semibold text-white">
                    Варианты
                  </h2>
                </div>
                <div class="divide-y divide-white/5">
                  <div
                    v-for="variant in data.variants"
                    :key="variant.id"
                    class="px-4 py-3 text-sm"
                  >
                    <p class="font-medium text-white">
                      v{{ variant.id }} - {{ formatStatus(variant.status) }}
                    </p>
                    <p class="mt-1 text-xs text-white/50">
                      {{ variant.pointCount }} точек - повтор {{ variant.retryCount }}
                    </p>
                    <p class="mt-1 text-xs text-white/45">
                      {{ variant.safeExplanation }}
                    </p>
                  </div>
                </div>
              </section>

              <section class="rounded-lg border border-white/10 bg-white/[0.025]">
                <div class="border-b border-white/10 px-4 py-3">
                  <h2 class="text-sm font-semibold text-white">
                    Безопасная лента событий
                  </h2>
                </div>
                <div class="max-h-[460px] divide-y divide-white/5 overflow-auto">
                  <div
                    v-for="event in data.events"
                    :key="`${event.sequence}:${event.type}`"
                    class="px-4 py-3 text-xs"
                  >
                    <p class="font-medium text-white/80">
                      #{{ event.sequence }} {{ event.type }}
                    </p>
                    <p class="mt-1 text-white/45">
                      {{ event.validationStatus }} - v{{ event.variantId || "-" }} - {{ formatDate(event.createdAt) }}
                    </p>
                  </div>
                  <div v-if="!data.events.length" class="px-4 py-6 text-sm text-white/50">
                    Метаданные событий не записаны.
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>
