#!/usr/bin/env node

/* eslint-disable no-console, node/no-process-env */

import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import process from "node:process";

import { loadDotEnv } from "./lib/load-env.mjs";

loadDotEnv();

import {
  describeE2eSocialPhotoDryRun,
  E2E_SOCIAL_PHOTO_STEPS,
  E2E_SOCIAL_PHOTO_TARGETS,
  runE2eSocialPhotoScenario,
} from "./lib/load-e2e-social-photo.mjs";
import { createMetricRecord, normalizeThresholds, summarizeLoadMetrics, writeLoadReports } from "./lib/load-metrics.mjs";
import { createRunManifest, DEFAULT_LOAD_OUTPUT_DIR, generateRunId, writeManifest } from "./lib/load-run-manifest.mjs";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_DURATION_SECONDS = 30;
const DEFAULT_TIMEOUT_MS = 15000;

const weatherPoints = encodeURIComponent(JSON.stringify([
  { lat: 48.8606, long: 2.3376, day: 1 },
  { lat: 48.853, long: 2.3499, day: 1 },
]));

const aiRouteBody = {
  context: {
    candidatePlaces: [
      {
        categories: ["culture"],
        coordinates: { lat: 48.8606, long: 2.3376 },
        description: "Synthetic candidate place",
        id: "load:louvre",
        name: "Louvre Museum",
        selected: true,
        source: "fallback",
      },
    ],
    city: {
      coordinates: { lat: 48.8566, long: 2.3522 },
      description: "Synthetic load-test city",
      id: "load:paris",
      label: "Paris, France",
      name: "Paris",
      provider: "nominatim",
      providerId: "load-paris",
      source: "fallback",
    },
    currentLocation: {
      enabled: false,
    },
    filters: {
      includeCandidatePlaces: true,
      includeSavedPlaces: true,
      interests: ["culture", "food", "nature"],
      query: "",
    },
    interests: ["culture", "food", "nature"],
    selectedDays: 1,
    selectedDiaryLogIds: [],
    selectedSavedPlaceIds: [],
  },
};

const scenarios = {
  "ai-stream": {
    defaults: { durationSeconds: 30, timeoutMs: 120000, vus: 1 },
    description: "Authenticated AI route streaming. Gated because it can spend provider quota unless the app is pointed at a mock provider.",
    requireAiOptIn: true,
    requireAuth: true,
    steps: [
      post("/api/ai/route", {
        body: JSON.stringify(aiRouteBody),
        drain: "stream",
        headers: { "content-type": "application/json" },
        name: "ai_route_stream",
      }),
    ],
  },
  "auth": {
    defaults: { durationSeconds: 60, vus: 10 },
    description: "Authenticated diary, feed, and route-history reads.",
    requireAuth: true,
    steps: [
      get("/api/locations", { name: "locations_index" }),
      get("/api/feed", { name: "feed_index" }),
      get("/api/ai/route-sessions", { name: "route_sessions" }),
    ],
  },
  "e2e-social-photo": {
    defaults: {
      durationSeconds: E2E_SOCIAL_PHOTO_TARGETS.durationSeconds,
      postDelayMs: E2E_SOCIAL_PHOTO_TARGETS.postDelayMs,
      targetComments: E2E_SOCIAL_PHOTO_TARGETS.targetComments,
      targetLikes: E2E_SOCIAL_PHOTO_TARGETS.targetLikes,
      targetPhotos: E2E_SOCIAL_PHOTO_TARGETS.targetPhotos,
      targetPosts: E2E_SOCIAL_PHOTO_TARGETS.targetPosts,
      users: E2E_SOCIAL_PHOTO_TARGETS.users,
      vus: E2E_SOCIAL_PHOTO_TARGETS.vus,
    },
    description: "Phase 13 local e2e profile: synthetic users, real photo upload path, feed posts, custom places, and feed/globe reads.",
    e2eSocialPhoto: true,
    requireStorageUploadOptIn: true,
    steps: E2E_SOCIAL_PHOTO_STEPS,
  },
  "explore": {
    defaults: { durationSeconds: 60, vus: 10 },
    description: "Authenticated Explore reads that avoid external provider fan-out by using fallback-friendly queries.",
    requireAuth: true,
    steps: [
      get("/api/explore/context", { name: "explore_context" }),
      get("/api/explore/candidate-places?cityName=Paris&interests=culture,food,nature", { name: "candidate_places_fallback" }),
      get("/api/explore/place-intelligence?name=Louvre%20Museum&lat=48.8606&long=2.3376&day=1", { name: "place_intelligence" }),
      get(`/api/explore/weather-tips?selectedDays=1&cityLabel=Paris&points=${weatherPoints}`, { name: "weather_tips" }),
    ],
  },
  "providers": {
    defaults: { durationSeconds: 30, vus: 2 },
    description: "Provider-touching Explore reads. Gated because it can hit Mapbox/Nominatim/Open-Meteo/Google APIs.",
    requireAuth: true,
    requireProviderOptIn: true,
    steps: [
      get("/api/explore/city-suggest?q=Paris&sessionToken=load-test-session", { name: "city_suggest_provider" }),
      get("/api/explore/candidate-places?cityName=Paris&interests=culture,food,nature&lat=48.8566&long=2.3522", { name: "candidate_places_provider" }),
      get(`/api/explore/weather-tips?selectedDays=1&cityLabel=Paris&points=${weatherPoints}`, { name: "weather_tips_provider" }),
    ],
  },
  "public": {
    defaults: { durationSeconds: 60, vus: 10 },
    description: "Unauthenticated public-page and public-photo reads.",
    steps: [
      get("/", { name: "home_page" }),
      get("/explore", { name: "explore_page" }),
      get("/api/public/place-photos?limit=25", { name: "public_place_photos" }),
      get("/api/public/place-photos?north=56&south=55&east=38&west=37&limit=25", { name: "bounded_public_place_photos" }),
    ],
  },
  "smoke": {
    defaults: { durationSeconds: 20, vus: 2 },
    description: "Small public-read smoke profile for checking that the target is reachable.",
    steps: [
      get("/", { name: "home_page" }),
      get("/api/public/place-photos?limit=10", { name: "public_place_photos" }),
    ],
  },
};

function get(path, options = {}) {
  return {
    className: "read",
    method: "GET",
    path,
    ...options,
  };
}

function post(path, options = {}) {
  return {
    className: "write",
    method: "POST",
    path,
    ...options,
  };
}

function parseCli(argv) {
  const options = {
    allowAi: isEnabled(process.env.LOAD_ENABLE_AI_STREAM),
    allowProviders: isEnabled(process.env.LOAD_ENABLE_PROVIDER_LOAD),
    allowStorageUpload: isEnabled(process.env.LOAD_ENABLE_STORAGE_UPLOAD),
    baseUrl: process.env.LOAD_BASE_URL || DEFAULT_BASE_URL,
    dryRun: false,
    durationSeconds: parseDuration(process.env.LOAD_DURATION),
    json: false,
    list: false,
    maxErrorRate: parseFloatOption(process.env.LOAD_MAX_ERROR_RATE),
    maxP95Ms: parseInteger(process.env.LOAD_MAX_P95_MS),
    maxReadP95Ms: parseInteger(process.env.LOAD_MAX_READ_P95_MS),
    maxTimeoutRate: parseFloatOption(process.env.LOAD_MAX_TIMEOUT_RATE),
    maxWriteP95Ms: parseInteger(process.env.LOAD_MAX_WRITE_P95_MS),
    outputDir: process.env.LOAD_OUTPUT_DIR || DEFAULT_LOAD_OUTPUT_DIR,
    postDelayMs: parseInteger(process.env.LOAD_POST_DELAY_MS),
    runId: process.env.LOAD_RUN_ID,
    scenarioName: "smoke",
    targetComments: parseInteger(process.env.LOAD_TARGET_COMMENTS),
    targetLikes: parseInteger(process.env.LOAD_TARGET_LIKES),
    targetPhotos: parseInteger(process.env.LOAD_TARGET_PHOTOS),
    targetPosts: parseInteger(process.env.LOAD_TARGET_POSTS),
    timeoutMs: parseInteger(process.env.LOAD_TIMEOUT_MS),
    users: parseInteger(process.env.LOAD_USERS),
    vus: parseInteger(process.env.LOAD_VUS),
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) {
    options.scenarioName = args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case "--allow-ai":
        options.allowAi = true;
        break;
      case "--allow-providers":
        options.allowProviders = true;
        break;
      case "--allow-storage-upload":
        options.allowStorageUpload = true;
        break;
      case "--base-url":
        options.baseUrl = requireValue(arg, args.shift());
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--duration":
        options.durationSeconds = parseDuration(requireValue(arg, args.shift()));
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--json":
        options.json = true;
        break;
      case "--list":
        options.list = true;
        break;
      case "--max-error-rate":
        options.maxErrorRate = parseFloatOption(requireValue(arg, args.shift()));
        break;
      case "--max-p95":
        options.maxP95Ms = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--max-read-p95":
        options.maxReadP95Ms = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--max-timeout-rate":
        options.maxTimeoutRate = parseFloatOption(requireValue(arg, args.shift()));
        break;
      case "--max-write-p95":
        options.maxWriteP95Ms = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--output-dir":
        options.outputDir = requireValue(arg, args.shift());
        break;
      case "--post-delay-ms":
        options.postDelayMs = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--run-id":
        options.runId = requireValue(arg, args.shift());
        break;
      case "--target-comments":
        options.targetComments = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--target-likes":
        options.targetLikes = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--target-photos":
        options.targetPhotos = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--target-posts":
        options.targetPosts = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--timeout":
        options.timeoutMs = parseDuration(requireValue(arg, args.shift())) * 1000;
        break;
      case "--users":
        options.users = parseInteger(requireValue(arg, args.shift()));
        break;
      case "--vus":
        options.vus = parseInteger(requireValue(arg, args.shift()));
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("-"))
    throw new Error(`${flag} requires a value`);

  return value;
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "")
    return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`Expected a positive integer, got: ${value}`);

  return parsed;
}

function parseFloatOption(value) {
  if (value === undefined || value === null || value === "")
    return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1)
    throw new Error(`Expected a number from 0 to 1, got: ${value}`);

  return parsed;
}

function parseDuration(value) {
  if (value === undefined || value === null || value === "")
    return undefined;

  const match = String(value).trim().match(/^(\d+)(ms|s|m)?$/);
  if (!match)
    throw new Error(`Expected duration like 30s, 2m, or 500ms, got: ${value}`);

  const amount = Number(match[1]);
  const unit = match[2] || "s";
  if (unit === "ms")
    return Math.max(1, Math.ceil(amount / 1000));
  if (unit === "m")
    return amount * 60;

  return amount;
}

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function printHelp() {
  console.log(`Usage: node tests/load/run-load.mjs [scenario] [options]

Scenarios:
${Object.entries(scenarios).map(([name, scenario]) => `  ${name.padEnd(18)} ${scenario.description}`).join("\n")}

Options:
  --base-url URL             Target base URL (default: ${DEFAULT_BASE_URL})
  --vus N                    Virtual users (default comes from scenario)
  --users N                  Synthetic users for e2e-social-photo
  --duration 30s|2m          Run duration (default comes from scenario)
  --timeout 15s              Per-request timeout
  --target-photos N          Target uploaded photos for e2e-social-photo
  --target-posts N           Target published posts for e2e-social-photo
  --target-likes N           Target post likes for e2e-social-photo
  --target-comments N        Target post comments for e2e-social-photo
  --post-delay-ms N          Sleep N ms after each post-publish journey (sequential pacing for live globe demo)
  --max-error-rate 0.01      Fail when error rate exceeds threshold
  --max-timeout-rate 0.005   Fail when timeout rate exceeds threshold
  --max-p95 750              Fail when overall p95 latency exceeds threshold in ms
  --max-read-p95 800         Fail when read p95 latency exceeds threshold in ms
  --max-write-p95 1500       Fail when write p95 latency exceeds threshold in ms
  --allow-ai                 Permit ai-stream scenario
  --allow-providers          Permit provider-touching scenario
  --allow-storage-upload     Permit full S3-compatible upload flow
  --output-dir DIR           Report/manifest output directory
  --run-id ID                Explicit run id
  --dry-run                  Print resolved scenario without network requests
  --list                     Print scenario names
  --json                     Print machine-readable summary

Auth/env:
  LOAD_AUTH_COOKIE           Cookie header copied from an authenticated browser session
  LOAD_AUTH_BEARER_TOKEN     Bearer token, if testing a token-based deployment path
  LOAD_CSRF_TOKEN            Optional CSRF header value for mutating endpoints
  LOAD_ENABLE_STORAGE_UPLOAD Set to 1 to permit e2e-social-photo S3-compatible upload
`);
}

function buildAuthHeaders() {
  const headers = {};

  if (process.env.LOAD_AUTH_COOKIE)
    headers.cookie = process.env.LOAD_AUTH_COOKIE;

  if (process.env.LOAD_AUTH_BEARER_TOKEN)
    headers.authorization = `Bearer ${process.env.LOAD_AUTH_BEARER_TOKEN}`;

  if (process.env.LOAD_CSRF_TOKEN)
    headers["x-csrf-token"] = process.env.LOAD_CSRF_TOKEN;

  return headers;
}

function validateScenario(name, scenario, options) {
  if (!scenario)
    throw new Error(`Unknown scenario "${name}". Run with --list to see available scenarios.`);

  if (options.dryRun)
    return;

  if (scenario.requireAuth && !process.env.LOAD_AUTH_COOKIE && !process.env.LOAD_AUTH_BEARER_TOKEN) {
    throw new Error(`Scenario "${name}" requires auth. Set LOAD_AUTH_COOKIE or LOAD_AUTH_BEARER_TOKEN.`);
  }

  if (scenario.requireAiOptIn && !options.allowAi) {
    throw new Error(`Scenario "${name}" can spend real AI provider quota. Set LOAD_ENABLE_AI_STREAM=1 or pass --allow-ai.`);
  }

  if (scenario.requireProviderOptIn && !options.allowProviders) {
    throw new Error(`Scenario "${name}" can hit external providers. Set LOAD_ENABLE_PROVIDER_LOAD=1 or pass --allow-providers.`);
  }

  if (scenario.requireStorageUploadOptIn && !options.allowStorageUpload) {
    throw new Error(`Scenario "${name}" uploads to S3-compatible storage. Set LOAD_ENABLE_STORAGE_UPLOAD=1 or pass --allow-storage-upload.`);
  }
}

async function runScenario(name, scenario, options) {
  const resolved = resolveScenarioOptions(scenario, options);
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const thresholds = normalizeThresholds({
    maxErrorRate: options.maxErrorRate,
    maxP95Ms: options.maxP95Ms,
    maxReadP95Ms: options.maxReadP95Ms,
    maxTimeoutRate: options.maxTimeoutRate,
    maxWriteP95Ms: options.maxWriteP95Ms,
  });
  const runId = options.runId || generateRunId();

  if (scenario.e2eSocialPhoto && options.dryRun) {
    return describeE2eSocialPhotoDryRun({
      baseUrl,
      options: resolved,
      outputDir: options.outputDir,
      runId,
      thresholds,
    });
  }

  if (options.dryRun) {
    return {
      baseUrl,
      dryRun: true,
      durationSeconds: resolved.durationSeconds,
      runId,
      scenario: name,
      steps: scenario.steps.map(step => ({
        className: step.className,
        method: step.method,
        name: step.name,
        path: step.path,
      })),
      thresholds,
      timeoutMs: resolved.timeoutMs,
      vus: resolved.vus,
    };
  }

  const records = [];
  const startedAt = performance.now();
  let created = {};
  let manifestPath;

  if (scenario.e2eSocialPhoto) {
    const manifest = createRunManifest({
      baseUrl,
      outputDir: options.outputDir,
      runId,
      scenario: name,
    });

    const counters = await runE2eSocialPhotoScenario({
      baseUrl,
      manifest,
      options: resolved,
      record: record => records.push(record),
      timeoutMs: resolved.timeoutMs,
    });

    created = {
      comments: counters.comments,
      likes: counters.likes,
      photos: counters.uploadedPhotos,
      places: counters.places,
      posts: counters.posts,
      s3Objects: counters.s3Objects,
      users: manifest.records.userIds.length,
    };
    manifestPath = await writeManifest({ manifest, outputDir: options.outputDir });
  }
  else {
    await Promise.all(Array.from({ length: resolved.vus }, (_, workerIndex) =>
      runWorker({
        authHeaders: buildAuthHeaders(),
        baseUrl,
        endAt: startedAt + resolved.durationSeconds * 1000,
        records,
        steps: scenario.steps,
        timeoutMs: resolved.timeoutMs,
        workerIndex,
      })));
  }

  const elapsedMs = performance.now() - startedAt;
  const summary = summarizeLoadMetrics({
    baseUrl,
    created,
    durationSeconds: resolved.durationSeconds,
    elapsedMs,
    records,
    runId,
    scenario: name,
    thresholds,
    vus: resolved.vus,
  });

  const reportPaths = await writeLoadReports({
    outputDir: options.outputDir,
    runId,
    summary,
  });

  return {
    ...summary,
    manifestPath,
    reportPaths,
  };
}

function resolveScenarioOptions(scenario, options) {
  return {
    allowStorageUpload: options.allowStorageUpload,
    durationSeconds: options.durationSeconds || scenario.defaults?.durationSeconds || DEFAULT_DURATION_SECONDS,
    postDelayMs: options.postDelayMs ?? scenario.defaults?.postDelayMs ?? 0,
    targetComments: options.targetComments || scenario.defaults?.targetComments,
    targetLikes: options.targetLikes || scenario.defaults?.targetLikes,
    targetPhotos: options.targetPhotos || scenario.defaults?.targetPhotos,
    targetPosts: options.targetPosts || scenario.defaults?.targetPosts,
    timeoutMs: options.timeoutMs || scenario.defaults?.timeoutMs || DEFAULT_TIMEOUT_MS,
    users: options.users || scenario.defaults?.users,
    vus: options.vus || scenario.defaults?.vus || 1,
  };
}

async function runWorker(input) {
  let stepIndex = input.workerIndex % input.steps.length;

  while (performance.now() < input.endAt) {
    const step = input.steps[stepIndex % input.steps.length];
    stepIndex += 1;
    input.records.push(await executeStep({
      authHeaders: input.authHeaders,
      baseUrl: input.baseUrl,
      step,
      timeoutMs: input.timeoutMs,
    }));
  }
}

async function executeStep({ authHeaders, baseUrl, step, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  const url = new URL(step.path, baseUrl);

  try {
    const response = await fetch(url, {
      body: step.body,
      headers: {
        "accept": step.drain === "stream" ? "text/event-stream" : "application/json, text/html;q=0.8",
        "user-agent": "WanderLog load runner",
        ...authHeaders,
        ...step.headers,
      },
      method: step.method,
      signal: controller.signal,
    });

    const firstByteAt = performance.now();
    const bytes = await drainResponse(response, step.drain);
    const durationMs = performance.now() - startedAt;
    const ok = response.status >= 200 && response.status < 400;

    return createMetricRecord({
      bytes,
      className: step.className,
      durationMs,
      method: step.method,
      name: step.name,
      ok,
      path: step.path,
      status: response.status,
      ttfbMs: firstByteAt - startedAt,
    });
  }
  catch (error) {
    return createMetricRecord({
      className: step.className,
      durationMs: performance.now() - startedAt,
      error: formatFetchError(error),
      method: step.method,
      name: step.name,
      ok: false,
      path: step.path,
      status: 0,
      timedOut: error?.name === "AbortError",
      ttfbMs: null,
    });
  }
  finally {
    clearTimeout(timeout);
  }
}

async function drainResponse(response, mode) {
  if (!response.body)
    return 0;

  if (mode !== "stream") {
    const text = await response.text();
    return Buffer.byteLength(text);
  }

  const reader = response.body.getReader();
  let bytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done)
      break;

    bytes += value.byteLength;
  }

  return bytes;
}

function formatFetchError(error) {
  if (error?.name === "AbortError")
    return "timeout";

  const cause = error?.cause;
  const details = [
    cause?.code,
    cause?.address,
    cause?.port,
  ].filter(Boolean).join(" ");

  const message = String(error?.message || error);
  return details ? `${message}: ${details}` : message;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith("/"))
    url.pathname = `${url.pathname}/`;

  return url.toString();
}

function printSummary(summary, json) {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (summary.dryRun) {
    console.log(`[load] ${summary.scenario} dry run`);
    console.log(`runId=${summary.runId} baseUrl=${summary.baseUrl} vus=${summary.vus} duration=${summary.durationSeconds}s`);
    if (summary.users)
      console.log(`users=${summary.users} targetPhotos=${summary.targetPhotos} targetPosts=${summary.targetPosts} targetLikes=${summary.targetLikes ?? "-"} targetComments=${summary.targetComments ?? "-"} postDelayMs=${summary.postDelayMs ?? 0} storageUploadOptIn=${summary.storageUploadOptIn}`);
    for (const step of summary.steps) {
      console.log(`- ${step.className} ${step.method} ${step.path} (${step.name})`);
    }
    return;
  }

  console.log(`[load] scenario=${summary.scenario} runId=${summary.runId} baseUrl=${summary.baseUrl}`);
  console.log(`[load] requests=${summary.requests} rps=${summary.requestsPerSecond} failures=${summary.failures} errorRate=${summary.errorRate} timeouts=${summary.timeouts} timeoutRate=${summary.timeoutRate}`);
  console.log(`[load] latency min=${summary.latencyMs.minMs}ms p50=${summary.latencyMs.p50Ms}ms p95=${summary.latencyMs.p95Ms}ms p99=${summary.latencyMs.p99Ms}ms max=${summary.latencyMs.maxMs}ms`);
  if (summary.created)
    console.log(`[load] created users=${summary.created.users ?? 0} photos=${summary.created.photos ?? 0} posts=${summary.created.posts ?? 0} places=${summary.created.places ?? 0} likes=${summary.created.likes ?? 0} comments=${summary.created.comments ?? 0} s3Objects=${summary.created.s3Objects ?? 0}`);
  console.log("[load] by step:");

  for (const [name, step] of Object.entries(summary.byStep)) {
    const error = step.sampleError ? ` sampleError=${step.sampleError}` : "";
    console.log(`  ${name}: requests=${step.requests} failures=${step.failures} p50=${step.p50Ms}ms p95=${step.p95Ms}ms p99=${step.p99Ms}ms timeouts=${step.timeouts} statuses=${JSON.stringify(step.statuses)}${error}`);
  }

  if (summary.reportPaths) {
    console.log(`[load] report=${summary.reportPaths.json}`);
    console.log(`[load] reportMarkdown=${summary.reportPaths.markdown}`);
  }

  if (summary.manifestPath)
    console.log(`[load] manifest=${summary.manifestPath}`);

  if (!summary.thresholdPassed) {
    console.error(`[load] threshold check failed: ${JSON.stringify(summary.thresholdFailures)}`);
  }
}

async function main() {
  const options = parseCli(process.argv.slice(2));

  if (options.list) {
    console.log(Object.keys(scenarios).join("\n"));
    return;
  }

  const scenario = scenarios[options.scenarioName];
  validateScenario(options.scenarioName, scenario, options);

  const summary = await runScenario(options.scenarioName, scenario, options);
  printSummary(summary, options.json);

  if (!summary.dryRun && !summary.thresholdPassed)
    process.exit(1);
}

main().catch((error) => {
  console.error(`[load] ${error.message}`);
  process.exit(1);
});
