import type { RouteEventEnvelope, RoutePoint } from "~/lib/ai/route-contract";
import type { ExploreRequestContext } from "~/lib/explore/context";

type RouteVariantState = {
  id: number;
  parentVariantId?: number;
  status: "generating" | "completed" | "failed";
  title?: string;
  summary?: string;
  pointCount: number;
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

const activePoints = computed(() => activeVariantId.value
  ? pointsByVariantId.value[activeVariantId.value] || []
  : []);

async function generateRoute(requestContext: ExploreRequestContext) {
  resetRouteSession();
  lastRequestContext.value = requestContext;
  await streamRouteEvents({ context: requestContext });
}

async function submitFollowUp(followUpMessage: string) {
  const message = followUpMessage.trim();
  if (!message || !lastRequestContext.value || !sessionId.value || !activeVariantId.value)
    return;

  await streamRouteEvents({
    context: lastRequestContext.value,
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
  sessionId.value = null;
  activeVariantId.value = null;
  variants.value = [];
  events.value = [];
  pointsByVariantId.value = {};
  isGenerating.value = false;
  error.value = null;
  lastWarning.value = null;
  lastRequestContext.value = null;
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

  try {
    const response = await fetch("/api/ai/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body)
      throw new Error("route_stream_unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done)
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
  }
  catch {
    error.value = "Route generation failed. Try again with adjusted preferences.";
  }
  finally {
    isGenerating.value = false;
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
    catch {
      lastWarning.value = "A route update could not be displayed.";
    }
  }
}

function appendRouteEvent(event: RouteEventEnvelope) {
  events.value.push(event);

  if (event.type === "route.session.created") {
    sessionId.value = event.sessionId;
    activeVariantId.value = event.activeVariantId ?? activeVariantId.value;
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

function splitReadyEventBlocks(buffer: string): [string[], string] {
  const blocks = buffer.split(/\r?\n\r?\n/);
  return [blocks.slice(0, -1), blocks.at(-1) || ""];
}

export function useAiRouteSession() {
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
    setActiveVariant,
    resetRouteSession,
  };
}
