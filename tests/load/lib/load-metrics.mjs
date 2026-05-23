import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_PHASE13_THRESHOLDS = Object.freeze({
  maxErrorRate: 0.01,
  maxReadP95Ms: 800,
  maxTimeoutRate: 0.005,
  maxWriteP95Ms: 1500,
});

export function normalizeThresholds(input = {}) {
  return {
    maxErrorRate: input.maxErrorRate ?? DEFAULT_PHASE13_THRESHOLDS.maxErrorRate,
    maxP95Ms: input.maxP95Ms,
    maxReadP95Ms: input.maxReadP95Ms ?? DEFAULT_PHASE13_THRESHOLDS.maxReadP95Ms,
    maxTimeoutRate: input.maxTimeoutRate ?? DEFAULT_PHASE13_THRESHOLDS.maxTimeoutRate,
    maxWriteP95Ms: input.maxWriteP95Ms ?? DEFAULT_PHASE13_THRESHOLDS.maxWriteP95Ms,
  };
}

export function createMetricRecord(input) {
  const status = Number(input.status ?? 0);
  const error = input.error ? redactMetricText(input.error) : undefined;
  const timedOut = input.timedOut ?? error === "timeout";

  return {
    bytes: input.bytes ?? 0,
    className: input.className ?? classifyRequest(input.method, input.path),
    durationMs: Math.round(input.durationMs ?? 0),
    error,
    method: input.method ?? "GET",
    name: input.name,
    ok: input.ok ?? (status >= 200 && status < 400),
    path: input.path,
    status,
    timedOut,
    ttfbMs: typeof input.ttfbMs === "number" ? Math.round(input.ttfbMs) : null,
  };
}

export function classifyRequest(method = "GET", path = "") {
  if (path.includes("/auth/profile"))
    return "setup";

  const upperMethod = method.toUpperCase();
  return upperMethod === "GET" || upperMethod === "HEAD" ? "read" : "write";
}

export function summarizeLoadMetrics({
  baseUrl,
  created = {},
  durationSeconds,
  elapsedMs,
  records,
  runId,
  scenario,
  thresholds = {},
  vus,
}) {
  const normalizedThresholds = normalizeThresholds(thresholds);
  const failures = records.filter(record => !record.ok);
  const timeouts = records.filter(record => record.timedOut);
  const requests = records.length;
  const errorRate = requests === 0 ? 1 : failures.length / requests;
  const timeoutRate = requests === 0 ? 0 : timeouts.length / requests;
  const byStep = summarizeGroup(records, record => record.name);
  const byClass = summarizeGroup(records, record => record.className);
  const latencyMs = summarizeEntries(records);
  const thresholdFailures = evaluateThresholds({
    byClass,
    errorRate,
    latencyMs,
    thresholds: normalizedThresholds,
    timeoutRate,
  });

  return {
    baseUrl,
    byClass,
    byStep,
    created,
    durationSeconds,
    elapsedMs: Math.round(elapsedMs),
    errorRate: round(errorRate, 4),
    failures: failures.length,
    latencyMs,
    requests,
    requestsPerSecond: round(requests / Math.max(1, elapsedMs / 1000), 2),
    runId,
    scenario,
    statusCounts: countStatuses(records),
    thresholdFailures,
    thresholdPassed: thresholdFailures.length === 0,
    thresholds: normalizedThresholds,
    timeouts: timeouts.length,
    timeoutRate: round(timeoutRate, 4),
    vus,
  };
}

export async function writeLoadReports({ outputDir, runId, summary }) {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, `${runId}-report.json`);
  const markdownPath = join(outputDir, `${runId}-report.md`);

  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(summary), "utf8");

  return {
    json: jsonPath,
    jsonPath,
    markdown: markdownPath,
    markdownPath,
  };
}

function summarizeGroup(records, groupBy) {
  const grouped = new Map();

  for (const record of records) {
    const key = groupBy(record);
    const entries = grouped.get(key) ?? [];
    entries.push(record);
    grouped.set(key, entries);
  }

  return Object.fromEntries([...grouped.entries()].map(([name, entries]) => [
    name,
    summarizeEntries(entries),
  ]));
}

function summarizeEntries(entries) {
  const durations = entries.map(entry => entry.durationMs).sort((a, b) => a - b);
  const ttfb = entries
    .map(entry => entry.ttfbMs)
    .filter(value => typeof value === "number")
    .sort((a, b) => a - b);
  const failures = entries.filter(entry => !entry.ok);
  const timeouts = entries.filter(entry => entry.timedOut);

  return {
    errorRate: round(entries.length === 0 ? 0 : failures.length / entries.length, 4),
    failures: failures.length,
    maxMs: Math.round(durations.at(-1) ?? 0),
    minMs: Math.round(durations[0] ?? 0),
    p50Ms: Math.round(percentile(durations, 50)),
    p95Ms: Math.round(percentile(durations, 95)),
    p99Ms: Math.round(percentile(durations, 99)),
    requests: entries.length,
    statuses: countStatuses(entries),
    timeoutRate: round(entries.length === 0 ? 0 : timeouts.length / entries.length, 4),
    timeouts: timeouts.length,
    ttfbP95Ms: Math.round(percentile(ttfb, 95)),
    sampleError: failures[0]?.error,
  };
}

function countStatuses(records) {
  return records.reduce((counts, record) => {
    const key = String(record.status);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function evaluateThresholds({ byClass, errorRate, latencyMs, thresholds, timeoutRate }) {
  const failures = [];

  if (thresholds.maxErrorRate !== undefined && errorRate > thresholds.maxErrorRate) {
    failures.push({
      actual: errorRate,
      limit: thresholds.maxErrorRate,
      metric: "error_rate",
    });
  }

  if (thresholds.maxTimeoutRate !== undefined && timeoutRate > thresholds.maxTimeoutRate) {
    failures.push({
      actual: timeoutRate,
      limit: thresholds.maxTimeoutRate,
      metric: "timeout_rate",
    });
  }

  if (thresholds.maxP95Ms !== undefined && latencyMs.p95Ms > thresholds.maxP95Ms) {
    failures.push({
      actual: latencyMs.p95Ms,
      limit: thresholds.maxP95Ms,
      metric: "overall_p95_ms",
    });
  }

  if (thresholds.maxReadP95Ms !== undefined && (byClass.read?.p95Ms ?? 0) > thresholds.maxReadP95Ms) {
    failures.push({
      actual: byClass.read.p95Ms,
      limit: thresholds.maxReadP95Ms,
      metric: "read_p95_ms",
    });
  }

  if (thresholds.maxWriteP95Ms !== undefined && (byClass.write?.p95Ms ?? 0) > thresholds.maxWriteP95Ms) {
    failures.push({
      actual: byClass.write.p95Ms,
      limit: thresholds.maxWriteP95Ms,
      metric: "write_p95_ms",
    });
  }

  return failures;
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0)
    return 0;

  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, index))];
}

function renderMarkdownReport(summary) {
  const thresholdRows = summary.thresholdFailures.length === 0
    ? "| all | passed | - | - |\n"
    : summary.thresholdFailures.map(failure =>
        `| ${failure.metric} | failed | ${failure.actual} | ${failure.limit} |`).join("\n");

  const stepRows = Object.entries(summary.byStep).map(([name, step]) =>
    `| ${name} | ${step.requests} | ${step.p50Ms} | ${step.p95Ms} | ${step.p99Ms} | ${step.failures} | ${step.timeouts} | ${JSON.stringify(step.statuses)} |`).join("\n");

  return `# Load Report ${summary.runId}

Scenario: ${summary.scenario}
Base URL: ${summary.baseUrl}
Virtual users: ${summary.vus}
Duration: ${summary.durationSeconds}s

## Totals

- Requests: ${summary.requests}
- RPS: ${summary.requestsPerSecond}
- Failures: ${summary.failures}
- Error rate: ${summary.errorRate}
- Timeouts: ${summary.timeouts}
- Timeout rate: ${summary.timeoutRate}
- Created users: ${summary.created.users ?? 0}
- Created photos: ${summary.created.photos ?? 0}
- Created posts: ${summary.created.posts ?? 0}
- Created places: ${summary.created.places ?? 0}
- S3 objects: ${summary.created.s3Objects ?? 0}

## Thresholds

| metric | status | actual | limit |
| --- | --- | --- | --- |
${thresholdRows}

## Steps

| step | requests | p50 ms | p95 ms | p99 ms | failures | timeouts | statuses |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${stepRows}
`;
}

function redactMetricText(value) {
  return String(value)
    .replace(new RegExp("better-auth\\.session_token" + "=[^;\\s]+", "g"), "better-auth.session_token:[redacted]")
    .replace(new RegExp("X-Amz-Signature" + "=[^&\\s]+", "g"), "X-Amz-Signature:[redacted]")
    .replace(/token[=:][^&\s]+/gi, "token=[redacted]");
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
