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
let pollingTimer: number | null = null;

const activeGenerationSessions = computed(() => sessions.value.filter(session => session.status === "generating"));
const latestCompletedSession = computed(() => sessions.value.find(session => session.status === "completed") ?? null);
const hasActiveGeneration = computed(() => activeGenerationSessions.value.length > 0);

async function refreshRouteGenerationStatus(options: { activeOnly?: boolean } = {}) {
  if (!import.meta.client)
    return;

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
    console.error("[useRouteGenerationStatus] Route generation status refresh failed", caughtError);
    statusError.value = "Route generation status could not be refreshed.";
  }
  finally {
    isLoading.value = false;
  }
}

function startRouteGenerationStatusPolling(intervalMs = 8000) {
  if (!import.meta.client || pollingTimer)
    return;

  void refreshRouteGenerationStatus();
  pollingTimer = window.setInterval(() => {
    void refreshRouteGenerationStatus();
  }, intervalMs);
}

function stopRouteGenerationStatusPolling() {
  if (!import.meta.client || !pollingTimer)
    return;

  window.clearInterval(pollingTimer);
  pollingTimer = null;
}

export function useRouteGenerationStatus() {
  return {
    activeGenerationSessions,
    hasActiveGeneration,
    isLoading,
    lastLoadedAt,
    latestCompletedSession,
    refreshRouteGenerationStatus,
    sessions,
    startRouteGenerationStatusPolling,
    statusError,
    stopRouteGenerationStatusPolling,
  };
}
