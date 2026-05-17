/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const safeObservabilitySource = await readFile("utils/safe-observability.ts", "utf8");
const runnerSource = await readFile("lib/ai/route-generation-runner.ts", "utf8");
const nuxtConfigSource = await readFile("nuxt.config.ts", "utf8");

test("safe observability utility redacts secret and payload-shaped metadata", () => {
  assert.match(safeObservabilitySource, /export function sanitizeLogMetadata/);
  assert.match(safeObservabilitySource, /export function logSafeServerEvent/);
  assert.match(safeObservabilitySource, /SENSITIVE_KEY_PATTERN/);
  assert.match(safeObservabilitySource, /SECRET_VALUE_PATTERN/);
  assert.match(safeObservabilitySource, /authorization\|token\|secret\|password/);
  assert.match(safeObservabilitySource, /payload\|body\|preview\|raw\|context\|stack\|message/);
});

test("route generation runner logs sanitized operational metadata only", () => {
  assert.match(runnerSource, /logSafeServerEvent/);
  assert.doesNotMatch(runnerSource, /console\.(error|warn)/);
  assert.doesNotMatch(runnerSource, /previewValue/);
  assert.doesNotMatch(runnerSource, /bufferedTextPreview/);
  assert.doesNotMatch(runnerSource, /providerBodyPreview/);
  assert.doesNotMatch(runnerSource, /message:\s*error/);
  assert.doesNotMatch(runnerSource, /requestContextJson/);
  assert.doesNotMatch(runnerSource, /payloadJson/);
  assert.doesNotMatch(runnerSource, /Authorization/);
});

test("public runtime config does not expose server-only provider credentials", () => {
  const publicStart = nuxtConfigSource.indexOf("public: {");
  const publicEnd = nuxtConfigSource.indexOf("yandexMaps:", publicStart);
  const publicConfig = publicStart >= 0 && publicEnd > publicStart
    ? nuxtConfigSource.slice(publicStart, publicEnd)
    : "";

  for (const secretName of [
    "OPENAI_API_KEY",
    "CEREBRAS_API_KEY",
    "MISTRAL_API_KEY",
    "OPENROUTER_API_KEY",
    "TURSO_AUTH_TOKEN",
    "S3_SECRET_KEY",
  ]) {
    assert.doesNotMatch(publicConfig, new RegExp(secretName));
  }

  assert.match(publicConfig, /sentryDsn/);
  assert.match(publicConfig, /mapboxToken/);
});
