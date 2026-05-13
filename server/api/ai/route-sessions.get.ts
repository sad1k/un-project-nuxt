import { findAiRouteSessionSummariesByUserId } from "~/lib/db/queries/ai-route";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const STALE_GENERATION_MS = 15 * 60 * 1000;

export default defineAuthenticatedHandler(async (event) => {
  const query = getQuery(event);
  const activeOnly = query.activeOnly === "true";
  const summaries = await findAiRouteSessionSummariesByUserId(event.context.user.id, { activeOnly });

  const now = Date.now();

  return {
    generatedAt: Date.now(),
    sessions: summaries.map((summary) => {
      const isStale = summary.status === "generating"
        && typeof summary.generationHeartbeatAt === "number"
        && now - summary.generationHeartbeatAt > STALE_GENERATION_MS;

      return {
        ...summary,
        displayStatus: isStale ? "stale" : summary.status,
        isStale,
      };
    }),
    staleGenerationMs: STALE_GENERATION_MS,
  };
});
