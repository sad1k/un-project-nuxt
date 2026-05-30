import type { RouteEventEnvelope, RoutePoint, RoutePointPatch } from "~/lib/ai/route-contract";
import type { ExploreRequestContext } from "~/lib/explore/context";

type RouteDiarySaveSummary = {
  expectedPointCount: number;
  failedCount: number;
  locationLogIds: number[];
  pendingCount: number;
  savedCount: number;
  status: "pending" | "saved" | "partial" | "failed";
};

type RouteVariantState = {
  id: number;
  parentVariantId?: number;
  status: "generating" | "completed" | "failed";
  title?: string;
  summary?: string;
  failureCode?: string;
  diarySave?: RouteDiarySaveSummary;
  generationStartedAt?: number;
  generationHeartbeatAt?: number;
  generationCompletedAt?: number;
  notificationStatus?: "pending" | "delivered" | "failed" | "dismissed";
  pointCount: number;
};

type RouteSessionSnapshot = {
  sessionId: number;
  status: "generating" | "completed" | "failed";
  activeVariantId: number | null;
  requestContext: ExploreRequestContext | null;
  variants: RouteVariantState[];
  events: RouteEventEnvelope[];
  pointsByVariantId: Record<number, RoutePoint[]>;
};

const sessionId = ref<number | null>(null);
const activeVariantId = ref<number | null>(null);
const variants = ref<RouteVariantState[]>([]);
const events = ref<RouteEventEnvelope[]>([]);
const pointsByVariantId = ref<Record<number, RoutePoint[]>>({});
const isGenerating = ref(false);
const error = ref<string | null>(null);
const lastWarning = ref<string | null>(null);
const lastRequestContext = ref<ExploreRequestContext | null>(null);
const ROUTE_UNLOAD_DIAGNOSTIC_KEY = "wanderlog.routeGeneration.unload";
const ROUTE_SESSION_STORAGE_KEY = "wanderlog.routeGeneration.sessionId";
let routeDiagnosticsInstalled = false;
let activeStreamController: AbortController | null = null;

const activePoints = computed(() => activeVariantId.value
  ? pointsByVariantId.value[activeVariantId.value] || []
  : []);

async function generateRoute(
  requestContext: ExploreRequestContext,
  options?: { followUpMessage?: string },
) {
  resetRouteSession();
  lastRequestContext.value = requestContext;
  await streamRouteEvents({
    context: requestContext,
    followUpMessage: options?.followUpMessage?.trim() || undefined,
  });
}

async function submitFollowUp(
  followUpMessage: string,
  contextPatch?: Partial<ExploreRequestContext>,
) {
  const message = followUpMessage.trim();
  if (!message || !lastRequestContext.value || !sessionId.value || !activeVariantId.value)
    return;

  await streamRouteEvents({
    context: { ...lastRequestContext.value, ...contextPatch },
    sessionId: sessionId.value,
    activeVariantId: activeVariantId.value,
    followUpMessage: message,
  });
}

function setActiveVariant(variantId: number) {
  if (variants.value.some(variant => variant.id === variantId))
    activeVariantId.value = variantId;
}

function resetRouteSession() {
  // Abort any in-flight generation so its stream cannot repopulate the state
  // we are about to clear.
  activeStreamController?.abort();
  activeStreamController = null;
  sessionId.value = null;
  activeVariantId.value = null;
  variants.value = [];
  events.value = [];
  pointsByVariantId.value = {};
  isGenerating.value = false;
  error.value = null;
  lastWarning.value = null;
  lastRequestContext.value = null;
  persistRouteSessionReference(null);
}

async function restoreRouteSession(explicitSessionId?: number) {
  if (!import.meta.client)
    return;

  const nextSessionId = explicitSessionId ?? readStoredRouteSessionId();
  if (!nextSessionId || (!explicitSessionId && sessionId.value))
    return;

  try {
    const snapshot = await loadRouteSessionSnapshot(nextSessionId);
    applyRouteSessionSnapshot(snapshot);
  }
  catch (caughtError) {
    console.error("[useAiRouteSession] Route session restore failed", {
      error: serializeError(caughtError),
      storedSessionId: nextSessionId,
      ...getClientDiagnosticContext(),
    });
    persistRouteSessionReference(null);
  }
}

async function loadRouteSessionSnapshot(nextSessionId: number) {
  return $fetch<RouteSessionSnapshot>(`/api/ai/route/${nextSessionId}`);
}

async function refreshCurrentRouteSessionSnapshot() {
  if (!sessionId.value)
    return;

  try {
    applyRouteSessionSnapshot(await loadRouteSessionSnapshot(sessionId.value));
  }
  catch (caughtError) {
    console.error("[useAiRouteSession] Route session refresh failed", {
      error: serializeError(caughtError),
      ...getClientDiagnosticContext(),
    });
  }
}

async function saveRoutePointToDiary(routePointId: string) {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const { csrf } = useCsrf();
  await $fetch(`/api/ai/route/${sessionId.value}/diary`, {
    method: "POST",
    headers: csrf ? { "csrf-token": csrf } : undefined,
    body: {
      routePointId,
      variantId: activeVariantId.value,
    },
  });
  await refreshCurrentRouteSessionSnapshot();
}

async function updateRoutePoint(routePointId: string, patch: RoutePointPatch) {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  const index = previous.findIndex(point => point.id === routePointId);
  if (index === -1)
    return;

  const optimistic = [...previous];
  optimistic[index] = applyPatchToRoutePoint(optimistic[index], patch);
  pointsByVariantId.value = {
    ...pointsByVariantId.value,
    [variantId]: [...optimistic].sort((first, second) => first.day - second.day),
  };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/point/${encodeURIComponent(routePointId)}`, {
      method: "PATCH",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      body: { variantId, patch },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось сохранить изменение точки.";
    console.error("[useAiRouteSession] updateRoutePoint failed", serializeError(caughtError));
  }
}

async function deleteRoutePoint(routePointId: string) {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  if (!previous.some(point => point.id === routePointId))
    return;

  pointsByVariantId.value = {
    ...pointsByVariantId.value,
    [variantId]: previous.filter(point => point.id !== routePointId),
  };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/point/${encodeURIComponent(routePointId)}`, {
      method: "DELETE",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      query: { variantId },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось удалить точку.";
    console.error("[useAiRouteSession] deleteRoutePoint failed", serializeError(caughtError));
  }
}

async function clearActivePoints() {
  if (!sessionId.value || !activeVariantId.value)
    return;

  const variantId = activeVariantId.value;
  const previous = pointsByVariantId.value[variantId] || [];
  if (!previous.length)
    return;

  pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: [] };
  refreshVariantPointCount(variantId);

  try {
    const { csrf } = useCsrf();
    await $fetch(`/api/ai/route/${sessionId.value}/points/clear`, {
      method: "POST",
      headers: csrf ? { "csrf-token": csrf } : undefined,
      body: { variantId },
    });
  }
  catch (caughtError) {
    pointsByVariantId.value = { ...pointsByVariantId.value, [variantId]: previous };
    refreshVariantPointCount(variantId);
    lastWarning.value = "Не удалось очистить точки.";
    console.error("[useAiRouteSession] clearActivePoints failed", serializeError(caughtError));
  }
}

async function streamRouteEvents(payload: {
  context: ExploreRequestContext;
  sessionId?: number;
  activeVariantId?: number;
  followUpMessage?: string;
}) {
  isGenerating.value = true;
  error.value = null;
  lastWarning.value = null;
  let streamCompleted = false;

  const controller = new AbortController();
  activeStreamController?.abort();
  activeStreamController = controller;

  try {
    const { csrf } = useCsrf();
    if (!csrf) {
      console.error("[useAiRouteSession] Missing CSRF token before route stream request", getClientDiagnosticContext());
    }

    const response = await fetch("/api/ai/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "csrf-token": csrf,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const failure = await readRouteStreamFailure(response);
      console.error("[useAiRouteSession] Route stream response rejected", {
        ...failure,
        ...getClientDiagnosticContext(),
      });
      throw new Error(`route_stream_unavailable:${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      if (controller.signal.aborted)
        break;

      buffer += decoder.decode(value, { stream: true });
      const [eventBlocks, rest] = splitReadyEventBlocks(buffer);
      buffer = rest;

      for (const block of eventBlocks)
        appendSseBlock(block);
    }

    const finalText = decoder.decode();
    if (finalText)
      buffer += finalText;

    if (buffer)
      appendSseBlock(buffer);

    streamCompleted = true;
  }
  catch (caughtError) {
    // A user-triggered cancel aborts the fetch — that is expected, not a failure.
    if (!controller.signal.aborted) {
      console.error("[useAiRouteSession] Route stream failed", {
        error: serializeError(caughtError),
        ...getClientDiagnosticContext(),
      });
      error.value = "Не удалось сгенерировать маршрут. Попробуйте изменить пожелания.";
    }
  }
  finally {
    if (activeStreamController === controller)
      activeStreamController = null;
    isGenerating.value = false;

    if (streamCompleted)
      await refreshCurrentRouteSessionSnapshot();
  }
}

function appendSseBlock(block: string) {
  const lines = block
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice("data:".length).trim())
    .filter(Boolean);

  for (const line of lines) {
    try {
      appendRouteEvent(JSON.parse(line) as RouteEventEnvelope);
    }
    catch (caughtError) {
      console.error("[useAiRouteSession] Route SSE block could not be parsed", {
        error: serializeError(caughtError),
        linePreview: line.slice(0, 500),
        ...getClientDiagnosticContext(),
      });
      lastWarning.value = "Не удалось показать обновление маршрута.";
    }
  }
}

function appendRouteEvent(event: RouteEventEnvelope) {
  events.value.push(event);

  if (event.type === "route.session.created") {
    sessionId.value = event.sessionId;
    activeVariantId.value = event.activeVariantId ?? activeVariantId.value;
    persistRouteSessionReference(event.sessionId);
    return;
  }

  if (event.type === "route.variant.started") {
    upsertVariant({
      id: event.variantId,
      parentVariantId: event.parentVariantId,
      status: "generating",
      title: event.title || `Route ${variants.value.length + 1}`,
      pointCount: pointsByVariantId.value[event.variantId]?.length || 0,
    });
    activeVariantId.value = event.variantId;
    return;
  }

  if (event.type === "route.point.added" || event.type === "route.point.updated") {
    upsertPoint(event.variantId, event.point, event.type === "route.point.updated");
    refreshVariantPointCount(event.variantId);
    return;
  }

  if (event.type === "route.variant.completed") {
    upsertVariant({
      id: event.variantId,
      status: "completed",
      title: event.title || getVariant(event.variantId)?.title || `Route ${event.variantId}`,
      summary: event.summary,
      pointCount: pointsByVariantId.value[event.variantId]?.length || 0,
    });
    activeVariantId.value = event.variantId;
    return;
  }

  if (event.type === "route.warning") {
    lastWarning.value = event.message;
    return;
  }

  if (event.type === "route.failed") {
    console.error("[useAiRouteSession] Route generation failed event received", {
      code: event.code,
      message: event.message,
      sessionId: event.sessionId,
      variantId: event.variantId,
    });
    error.value = event.message;
    if (event.variantId) {
      upsertVariant({
        id: event.variantId,
        status: "failed",
        title: getVariant(event.variantId)?.title || `Route ${event.variantId}`,
        pointCount: pointsByVariantId.value[event.variantId]?.length || 0,
      });
    }
  }
}

function upsertPoint(variantId: number, point: RoutePoint, replaceExisting: boolean) {
  const currentPoints = pointsByVariantId.value[variantId] || [];
  const existingIndex = currentPoints.findIndex(entry => entry.id === point.id);
  const nextPoints = [...currentPoints];

  if (existingIndex >= 0 && replaceExisting) {
    nextPoints.splice(existingIndex, 1, point);
  }
  else if (existingIndex === -1) {
    nextPoints.push(point);
  }

  pointsByVariantId.value = {
    ...pointsByVariantId.value,
    [variantId]: nextPoints.sort((first, second) => first.day - second.day),
  };
}

function applyPatchToRoutePoint(point: RoutePoint, patch: RoutePointPatch): RoutePoint {
  return {
    ...point,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.day !== undefined ? { day: patch.day } : {}),
    ...(patch.coordinates ? { coordinates: patch.coordinates } : {}),
    ...(patch.estimatedStart !== undefined ? { estimatedStart: patch.estimatedStart } : {}),
    ...(patch.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: patch.estimatedDurationMinutes } : {}),
    ...(patch.rationale !== undefined ? { rationale: patch.rationale } : {}),
  };
}

function upsertVariant(nextVariant: RouteVariantState) {
  const index = variants.value.findIndex(variant => variant.id === nextVariant.id);
  if (index === -1) {
    variants.value = [...variants.value, nextVariant];
    return;
  }

  const nextVariants = [...variants.value];
  nextVariants.splice(index, 1, {
    ...nextVariants[index],
    ...nextVariant,
  });
  variants.value = nextVariants;
}

function refreshVariantPointCount(variantId: number) {
  const variant = getVariant(variantId);
  if (!variant)
    return;

  upsertVariant({
    ...variant,
    pointCount: pointsByVariantId.value[variantId]?.length || 0,
  });
}

function getVariant(variantId: number) {
  return variants.value.find(variant => variant.id === variantId);
}

function applyRouteSessionSnapshot(snapshot: RouteSessionSnapshot) {
  sessionId.value = snapshot.sessionId;
  activeVariantId.value = snapshot.activeVariantId ?? snapshot.variants[0]?.id ?? null;
  variants.value = snapshot.variants;
  events.value = snapshot.events;
  pointsByVariantId.value = snapshot.pointsByVariantId;
  lastRequestContext.value = snapshot.requestContext;
  isGenerating.value = false;
  error.value = null;
  lastWarning.value = snapshot.status === "generating"
    ? "Генерация маршрута была прервана. Восстановлен последний сохранённый прогресс."
    : null;
  persistRouteSessionReference(snapshot.sessionId);
}

function readStoredRouteSessionId() {
  const stored = window.sessionStorage.getItem(ROUTE_SESSION_STORAGE_KEY);
  if (!stored)
    return null;

  const parsed = Number(stored);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    persistRouteSessionReference(null);
    return null;
  }

  return parsed;
}

function persistRouteSessionReference(nextSessionId: number | null) {
  if (!import.meta.client)
    return;

  if (nextSessionId) {
    window.sessionStorage.setItem(ROUTE_SESSION_STORAGE_KEY, String(nextSessionId));
    return;
  }

  window.sessionStorage.removeItem(ROUTE_SESSION_STORAGE_KEY);
}

function splitReadyEventBlocks(buffer: string): [string[], string] {
  const blocks = buffer.split(/\r?\n\r?\n/);
  return [blocks.slice(0, -1), blocks.at(-1) || ""];
}

async function readRouteStreamFailure(response: Response) {
  let bodyPreview = "";

  try {
    bodyPreview = (await response.clone().text()).slice(0, 1000);
  }
  catch (caughtError) {
    bodyPreview = `Could not read error body: ${serializeError(caughtError).message}`;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    bodyPreview,
  };
}

function getClientDiagnosticContext() {
  if (!import.meta.client) {
    return {
      activeVariantId: activeVariantId.value,
      eventCount: events.value.length,
      pointCount: activePoints.value.length,
      sessionId: sessionId.value,
    };
  }

  return {
    activeVariantId: activeVariantId.value,
    eventCount: events.value.length,
    href: window.location.href,
    isGenerating: isGenerating.value,
    isOnline: window.navigator.onLine,
    pointCount: activePoints.value.length,
    sessionId: sessionId.value,
  };
}

function serializeError(input: unknown) {
  if (input instanceof Error) {
    return {
      message: input.message,
      name: input.name,
      stack: input.stack,
    };
  }

  return {
    message: String(input),
    name: typeof input,
  };
}

function installRouteReloadDiagnostics() {
  if (!import.meta.client || routeDiagnosticsInstalled)
    return;

  routeDiagnosticsInstalled = true;

  const previousUnload = window.sessionStorage.getItem(ROUTE_UNLOAD_DIAGNOSTIC_KEY);
  if (previousUnload) {
    console.error("[useAiRouteSession] Previous page unload happened during route generation", parseStoredDiagnostic(previousUnload));
    window.sessionStorage.removeItem(ROUTE_UNLOAD_DIAGNOSTIC_KEY);
  }

  const recordUnload = (reason: string) => {
    if (!isGenerating.value)
      return;

    const diagnostic = {
      ...getClientDiagnosticContext(),
      reason,
      timestamp: new Date().toISOString(),
    };

    window.sessionStorage.setItem(ROUTE_UNLOAD_DIAGNOSTIC_KEY, JSON.stringify(diagnostic));
    console.error("[useAiRouteSession] Page is unloading during route generation", diagnostic);
  };

  window.addEventListener("beforeunload", () => recordUnload("beforeunload"));
  window.addEventListener("pagehide", () => recordUnload("pagehide"));
}

function parseStoredDiagnostic(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  }
  catch {
    return { raw: input };
  }
}

export function useAiRouteSession() {
  installRouteReloadDiagnostics();

  return {
    sessionId,
    activeVariantId,
    variants,
    events,
    pointsByVariantId,
    activePoints,
    isGenerating,
    error,
    lastWarning,
    generateRoute,
    submitFollowUp,
    saveRoutePointToDiary,
    updateRoutePoint,
    deleteRoutePoint,
    clearActivePoints,
    setActiveVariant,
    restoreRouteSession,
    resetRouteSession,
  };
}
