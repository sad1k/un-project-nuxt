import { findIdempotencyHit, recordIdempotencyResult } from "~/lib/db/queries/idempotency-key";

const WHITELIST_PATTERNS: RegExp[] = [
  /^\/api\/locations\/[^/]+\/\d+\/image$/,
  /^\/api\/locations\/[^/]+\/add$/,
  /^\/api\/locations\/[^/]+\/\d+$/,
  /^\/api\/posts$/,
  /^\/api\/posts\/\d+\/like$/,
  /^\/api\/posts\/\d+\/comments$/,
];

const BLOCKLIST_PATTERNS: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/health(\/|$)/,
];

export function shouldApplyMiddleware(input: { method: string; path: string }) {
  if (input.method !== "POST" && input.method !== "PUT" && input.method !== "DELETE")
    return false;
  if (BLOCKLIST_PATTERNS.some(p => p.test(input.path)))
    return false;
  return WHITELIST_PATTERNS.some(p => p.test(input.path));
}

export function isIdempotentEndpoint(path: string) {
  return WHITELIST_PATTERNS.some(p => p.test(path));
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  if (!shouldApplyMiddleware({ method: event.method, path: url.pathname }))
    return;
  const userId = event.context.user?.id;
  if (!userId)
    return;
  const opId = getRequestHeader(event, "x-client-op-id");
  if (!opId)
    return;

  const hit = await findIdempotencyHit(userId, opId, url.pathname);
  if (hit) {
    setResponseStatus(event, hit.statusCode);
    setResponseHeader(event, "content-type", "application/json");
    setResponseHeader(event, "x-idempotent-replay", "true");
    return JSON.parse(hit.responseBody);
  }

  // Stash metadata so endpoints can call recordIdempotentResponse() after they finish work
  event.context._idempotencyKey = { userId, opId, endpoint: url.pathname };
});

export async function recordIdempotentResponse(event: any, statusCode: number, body: unknown) {
  const meta = event.context._idempotencyKey;
  if (!meta)
    return;
  await recordIdempotencyResult(meta.userId, meta.opId, meta.endpoint, statusCode, JSON.stringify(body));
}
