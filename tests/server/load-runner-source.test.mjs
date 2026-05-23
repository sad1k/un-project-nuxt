/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const runnerSource = await readFile("tests/load/run-load.mjs", "utf8");
const metricsSource = await readFile("tests/load/lib/load-metrics.mjs", "utf8");
const manifestSource = await readFile("tests/load/lib/load-run-manifest.mjs", "utf8");
const localDbSource = await readFile("tests/load/lib/load-local-db.mjs", "utf8");
const authSeedSource = await readFile("tests/load/lib/load-auth-seed.mjs", "utf8");
const e2eSource = await readFile("tests/load/lib/load-e2e-social-photo.mjs", "utf8");
const s3UploadSource = await readFile("tests/load/lib/load-s3-upload.mjs", "utf8");
const cleanupSource = await readFile("tests/load/cleanup-run.mjs", "utf8");
const readmeSource = await readFile("tests/load/README.md", "utf8");
const packageSource = await readFile("package.json", "utf8");

test("Phase 13 runner uses modular foundation rather than one-off embedded logic", () => {
  assert.match(runnerSource, /load-e2e-social-photo\.mjs/);
  assert.match(runnerSource, /load-metrics\.mjs/);
  assert.match(runnerSource, /load-run-manifest\.mjs/);
  assert.match(runnerSource, /"e2e-social-photo"/);
});

test("metrics contract includes percentiles, status counts, classes, errors, timeouts, and thresholds", () => {
  assert.match(metricsSource, /p50Ms/);
  assert.match(metricsSource, /p95Ms/);
  assert.match(metricsSource, /p99Ms/);
  assert.match(metricsSource, /statusCounts/);
  assert.match(metricsSource, /timeoutRate/);
  assert.match(metricsSource, /thresholdFailures/);
  assert.match(metricsSource, /maxReadP95Ms/);
  assert.match(metricsSource, /maxWriteP95Ms/);
  assert.match(metricsSource, /classifyRequest/);
  assert.match(metricsSource, /read/);
  assert.match(metricsSource, /write/);
  assert.match(metricsSource, /setup/);
});

test("manifest and auth seeding are run-id marked and redact secrets", () => {
  assert.match(manifestSource, /generateRunId/);
  assert.match(manifestSource, /safeSessionTokenSuffixes/);
  assert.match(manifestSource, /s3ObjectKeys/);
  assert.match(manifestSource, /cleanupCommand/);
  assert.match(manifestSource, /delete clone\.rawCookies/);
  assert.match(authSeedSource, /load\+\$\{runId\}/);
  assert.match(authSeedSource, /\[.*runId.*\] Load User/);
  assert.match(authSeedSource, /better-auth\.session_token/);
  assert.match(authSeedSource, /\/api\/auth\/profile/);
  assert.match(localDbSource, /Refusing load seed\/cleanup against non-local database URL/);
});

test("e2e scenario contains the real social photo flow endpoints and default targets", () => {
  assert.match(e2eSource, /targetPhotos:\s*1000/);
  assert.match(e2eSource, /targetPosts:\s*1000/);
  assert.match(e2eSource, /users:\s*100/);
  assert.match(e2eSource, /durationSeconds:\s*600/);
  assert.match(e2eSource, /\/api\/place-photos\/create-private/);
  assert.match(e2eSource, /\/api\/locations\/:slug\/:id\/sign-images/);
  assert.match(e2eSource, /photo_s3_upload/);
  assert.match(e2eSource, /\/api\/locations\/:slug\/:id\/image/);
  assert.match(e2eSource, /\/api\/locations\/:slug\/:id\/images\/:image-id\/visibility/);
  assert.match(e2eSource, /\/api\/posts/);
  assert.match(e2eSource, /\/api\/feed\?limit=20/);
  assert.match(e2eSource, /\/api\/public\/place-photos\?limit=25/);
  assert.match(e2eSource, /\/api\/public\/feed-globe\?limit=100/);
});

test("storage upload is explicit opt-in and dry-run friendly", () => {
  assert.match(runnerSource, /LOAD_ENABLE_STORAGE_UPLOAD/);
  assert.match(runnerSource, /--allow-storage-upload/);
  assert.match(runnerSource, /describeE2eSocialPhotoDryRun/);
  assert.match(s3UploadSource, /Full S3-compatible upload is disabled/);
  assert.match(s3UploadSource, /FormData/);
  assert.match(s3UploadSource, /photo_s3_upload/);
});

test("reporting and cleanup contracts are explicit and run-id based", () => {
  assert.match(metricsSource, /writeLoadReports/);
  assert.match(metricsSource, /Load Report/);
  assert.match(metricsSource, /Created photos/);
  assert.match(cleanupSource, /--run-id/);
  assert.match(cleanupSource, /Refusing cleanup without --run-id/);
  assert.match(cleanupSource, /dry run only/);
  assert.match(cleanupSource, /DeleteObjectsCommand/);
  assert.match(readmeSource, /preserved after runs/i);
  assert.match(readmeSource, /separate cleanup/i);
});

test("package scripts expose e2e load and cleanup commands", () => {
  assert.match(packageSource, /"load:e2e"/);
  assert.match(packageSource, /"load:e2e:dry-run"/);
  assert.match(packageSource, /"load:cleanup"/);
});
