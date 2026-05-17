import { findAiRouteSessionSummariesByUserId } from "~/lib/db/queries/ai-route";
import { findRouteDiarySaveSummariesByVariantIds } from "~/lib/db/queries/route-diary-save";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const STALE_GENERATION_MS = 15 * 60 * 1000;

export default defineAuthenticatedHandler(async (event) => {
  const query = getQuery(event);
  const activeOnly = query.activeOnly === "true";
  const summaries = await findAiRouteSessionSummariesByUserId(event.context.user.id, { activeOnly });
  const variantIds = summaries
    .map(summary => summary.variantId)
    .filter((variantId): variantId is number => typeof variantId === "number");
  const diarySaveSummaries = await findRouteDiarySaveSummariesByVariantIds(event.context.user.id, variantIds, {
    expectedPointCounts: new Map(summaries.flatMap(summary => typeof summary.variantId === "number"
      ? [[summary.variantId, summary.pointCount] as const]
      : [])),
  });

  const now = Date.now();

  return {
    generatedAt: Date.now(),
    sessions: summaries.map((summary) => {
      const isStale = summary.status === "generating"
        && typeof summary.generationHeartbeatAt === "number"
        && now - summary.generationHeartbeatAt > STALE_GENERATION_MS;

      return {
        ...summary,
        diarySave: summary.variantId ? diarySaveSummaries.get(summary.variantId) ?? null : null,
        displayStatus: isStale ? "stale" : summary.status,
        isStale,
      };
    }),
    staleGenerationMs: STALE_GENERATION_MS,
  };
});
