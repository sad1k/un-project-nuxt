import type { AiRouteFailureStage } from "~/lib/db/queries/ai-route";

import { findAdminAiRouteSessionSummaries } from "~/lib/db/queries/ai-route";
import defineAdminHandler from "~/utils/define-admin-handler";

type AdminRouteStatus = "generating" | "completed" | "failed";

const FAILURE_STAGES = new Set<AiRouteFailureStage>([
  "validation",
  "provider",
  "parsing",
  "persistence",
  "diary_save",
  "notification",
  "unknown",
]);

const STATUSES = new Set<AdminRouteStatus>(["generating", "completed", "failed"]);

export default defineAdminHandler(async (event) => {
  const query = getQuery(event);

  return {
    generatedAt: Date.now(),
    sessions: await findAdminAiRouteSessionSummaries({
      failureCode: parseFailureCode(query.failureCode),
      failureStage: parseFailureStage(query.failureStage),
      from: parseTimestamp(query.from),
      limit: parseLimit(query.limit),
      status: parseStatus(query.status),
      to: parseTimestamp(query.to),
    }),
  };
});

function parseFailureCode(input: unknown) {
  return typeof input === "string" && input.trim()
    ? input.trim().slice(0, 80)
    : undefined;
}

function parseFailureStage(input: unknown) {
  return typeof input === "string" && FAILURE_STAGES.has(input as AiRouteFailureStage)
    ? input as AiRouteFailureStage
    : undefined;
}

function parseStatus(input: unknown) {
  return typeof input === "string" && STATUSES.has(input as AdminRouteStatus)
    ? input as AdminRouteStatus
    : undefined;
}

function parseLimit(input: unknown) {
  if (typeof input !== "string")
    return undefined;

  const limit = Number.parseInt(input, 10);
  return Number.isFinite(limit) ? limit : undefined;
}

function parseTimestamp(input: unknown) {
  if (typeof input !== "string")
    return undefined;

  const timestamp = Number.parseInt(input, 10);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
