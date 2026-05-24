type RouteDiarySaveSummary = {
  expectedPointCount: number;
  failedCount: number;
  locationLogIds: number[];
  pendingCount: number;
  savedCount: number;
  status: "pending" | "saved" | "partial" | "failed";
};

type RouteGenerationSessionSummary = {
  sessionId: number;
  activeVariantId: number | null;
  variantId: number | null;
  status: "generating" | "completed" | "failed";
  displayStatus: "generating" | "completed" | "failed" | "stale";
  cityName: string | null;
  title: string | null;
  summary: string | null;
  failureCode: string | null;
  pointCount: number;
  generationStartedAt: number | null;
  generationHeartbeatAt: number | null;
  generationCompletedAt: number | null;
  notificationStatus: "pending" | "delivered" | "failed" | "dismissed";
  diarySave: RouteDiarySaveSummary | null;
  retryCount: number;
  createdAt: number;
  updateAt: number;
  isStale: boolean;
};

type RouteGenerationStatusResponse = {
  generatedAt: number;
  staleGenerationMs: number;
  sessions: RouteGenerationSessionSummary[];
};

const sessions = ref<RouteGenerationSessionSummary[]>([]);
const isLoading = ref(false);
const statusError = ref<string | null>(null);
const lastLoadedAt = ref<number | null>(null);
const deletingSessionIds = ref<number[]>([]);
let pollingTimer: number | null = null;
let pollingStartPromise: Promise<void> | null = null;
let pollingSubscriberCount = 0;
let authInitPromise: Promise<void> | null = null;

const activeGenerationSessions = computed(() => sessions.value.filter(session => session.status === "generating" && !session.isStale));
const latestStaleGenerationSession = computed(() => sessions.value.find(session => session.isStale) ?? null);
const latestCompletedSession = computed(() => sessions.value.find(session => session.status === "completed") ?? null);
const hasActiveGeneration = computed(() => activeGenerationSessions.value.length > 0);

async function hasRouteGenerationStatusAccess() {
  const authStore = useAuthStore();
  if (authStore.user)
    return true;

  authInitPromise ??= authStore.init().finally(() => {
    authInitPromise = null;
  });

  await authInitPromise;
  return Boolean(authStore.user);
}

function isUnauthorizedStatus(caughtError: unknown) {
  if (!caughtError || typeof caughtError !== "object")
    return false;

  const error = caughtError as {
    response?: {
      status?: number;
      statusCode?: number;
    };
    status?: number;
    statusCode?: number;
  };

  return error.status === 401
    || error.statusCode === 401
    || error.response?.status === 401
    || error.response?.statusCode === 401;
}

function resetRouteGenerationStatusPolling() {
  pollingSubscriberCount = 0;

  if (!import.meta.client || !pollingTimer)
    return;

  window.clearInterval(pollingTimer);
  pollingTimer = null;
}

async function refreshRouteGenerationStatus(options: { activeOnly?: boolean } = {}) {
  if (!import.meta.client)
    return;

  if (!(await hasRouteGenerationStatusAccess())) {
    sessions.value = [];
    statusError.value = null;
    resetRouteGenerationStatusPolling();
    return;
  }

  isLoading.value = true;
  statusError.value = null;

  try {
    const response = await $fetch<RouteGenerationStatusResponse>("/api/ai/route-sessions", {
      query: {
        activeOnly: options.activeOnly ? "true" : undefined,
      },
    });
    sessions.value = response.sessions;
    lastLoadedAt.value = response.generatedAt;
  }
  catch (caughtError) {
    if (isUnauthorizedStatus(caughtError)) {
      sessions.value = [];
      statusError.value = null;
      resetRouteGenerationStatusPolling();
      return;
    }

    console.error("[useRouteGenerationStatus] Route generation status refresh failed", caughtError);
    statusError.value = "Не удалось обновить статус генерации маршрута.";
  }
  finally {
    isLoading.value = false;
  }
}

async function deleteRouteGenerationSession(sessionId: number) {
  if (!import.meta.client || deletingSessionIds.value.includes(sessionId))
    return;

  if (!(await hasRouteGenerationStatusAccess()))
    return;

  deletingSessionIds.value = [...deletingSessionIds.value, sessionId];
  statusError.value = null;

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId}`, {
      method: "DELETE",
      headers: csrf ? { "csrf-token": csrf } : undefined,
    });
    sessions.value = sessions.value.filter(session => session.sessionId !== sessionId);
  }
  catch (caughtError) {
    if (isUnauthorizedStatus(caughtError)) {
      sessions.value = [];
      statusError.value = null;
      resetRouteGenerationStatusPolling();
      return;
    }

    console.error("[useRouteGenerationStatus] Route generation session delete failed", caughtError);
    statusError.value = "Не удалось удалить генерацию маршрута.";
  }
  finally {
    deletingSessionIds.value = deletingSessionIds.value.filter(id => id !== sessionId);
  }
}

function startRouteGenerationStatusPolling(intervalMs = 8000) {
  if (!import.meta.client)
    return;

  pollingSubscriberCount += 1;

  if (pollingTimer || pollingStartPromise)
    return;

  pollingStartPromise = (async () => {
    if (!(await hasRouteGenerationStatusAccess()))
      return;

    if (pollingSubscriberCount <= 0 || pollingTimer)
      return;

    void refreshRouteGenerationStatus();
    pollingTimer = window.setInterval(() => {
      void refreshRouteGenerationStatus();
    }, intervalMs);
  })().finally(() => {
    pollingStartPromise = null;
  });
}

function stopRouteGenerationStatusPolling() {
  if (!import.meta.client)
    return;

  pollingSubscriberCount = Math.max(0, pollingSubscriberCount - 1);
  if (pollingSubscriberCount > 0 || !pollingTimer)
    return;

  window.clearInterval(pollingTimer);
  pollingTimer = null;
}

export function useRouteGenerationStatus() {
  return {
    activeGenerationSessions,
    deleteRouteGenerationSession,
    deletingSessionIds,
    hasActiveGeneration,
    isLoading,
    lastLoadedAt,
    latestCompletedSession,
    latestStaleGenerationSession,
    refreshRouteGenerationStatus,
    sessions,
    startRouteGenerationStatusPolling,
    statusError,
    stopRouteGenerationStatusPolling,
  };
}
