type SafeLogLevel = "info" | "warn" | "error";
type SafeLogMetadata = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /authorization|token|secret|password|api[-_]?key|payload|body|preview|raw|context|stack|message/i;
const SECRET_VALUE_PATTERN = /bearer\s+[\w.-]+|csk-[\w-]+|sk-[\w-]+/gi;

export function sanitizeLogMetadata(input: SafeLogMetadata = {}) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      sanitizeLogValue(key, value),
    ]),
  );
}

export function logSafeServerEvent(
  level: SafeLogLevel,
  eventName: string,
  metadata: SafeLogMetadata = {},
) {
  const sanitized = sanitizeLogMetadata(metadata);
  const log = level === "error" ? console.error : console.warn;

  log(`[${eventName}]`, sanitized);
}

export function getSafeErrorCode(input: unknown, fallback = "unexpected_error") {
  if (typeof input !== "string")
    return fallback;

  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function sanitizeLogValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key))
    return "[redacted]";

  if (value === null || value === undefined)
    return value;

  if (typeof value === "string")
    return value.replace(SECRET_VALUE_PATTERN, "[redacted]").slice(0, 160);

  if (typeof value === "number" || typeof value === "boolean")
    return value;

  if (Array.isArray(value)) {
    if (depth >= 2)
      return `[array:${value.length}]`;

    return value.slice(0, 20).map((entry, index) => sanitizeLogValue(String(index), entry, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2)
      return "[object]";

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeLogValue(nestedKey, nestedValue, depth + 1),
      ]),
    );
  }

  return String(value).slice(0, 160);
}
