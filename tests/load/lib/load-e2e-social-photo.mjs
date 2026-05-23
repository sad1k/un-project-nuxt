import { performance } from "node:perf_hooks";

import { preflightSeededAuth, seedSyntheticAuthUsers } from "./load-auth-seed.mjs";
import { bootstrapCsrfForSession, buildAuthedWriteHeaders } from "./load-csrf.mjs";
import { createDeterministicImageFixture } from "./load-image-fixture.mjs";
import { createMetricRecord } from "./load-metrics.mjs";
import { rememberCreated } from "./load-run-manifest.mjs";
import { performSignedS3Upload, timedJsonRequest } from "./load-s3-upload.mjs";

export const E2E_SOCIAL_PHOTO_TARGETS = Object.freeze({
  durationSeconds: 600,
  targetPhotos: 1000,
  targetPosts: 1000,
  users: 100,
  vus: 100,
});

export const E2E_SOCIAL_PHOTO_MIX = Object.freeze({
  customPlaceCreates: 0.10,
  feedReads: 0.40,
  photoUploads: 0.25,
  postPublishes: 0.20,
  publicGlobeReads: 0.05,
});

export const E2E_SOCIAL_PHOTO_STEPS = Object.freeze([
  { className: "setup", method: "GET", name: "auth_profile_preflight", path: "/api/auth/profile" },
  { className: "write", method: "POST", name: "create_private_place_photo", path: "/api/place-photos/create-private" },
  { className: "write", method: "POST", name: "photo_sign_upload", path: "/api/locations/:slug/:id/sign-images" },
  { className: "write", method: "POST", name: "photo_s3_upload", path: "[signed-s3-upload]" },
  { className: "write", method: "POST", name: "photo_metadata_write", path: "/api/locations/:slug/:id/image" },
  { className: "write", method: "PATCH", name: "photo_visibility_public", path: "/api/locations/:slug/:id/images/:image-id/visibility" },
  { className: "write", method: "POST", name: "feed_post_publish", path: "/api/posts" },
  { className: "read", method: "GET", name: "feed_read", path: "/api/feed?limit=20" },
  { className: "read", method: "GET", name: "public_place_photos_read", path: "/api/public/place-photos?limit=25" },
  { className: "read", method: "GET", name: "public_feed_globe_read", path: "/api/public/feed-globe?limit=100" },
]);

export function describeE2eSocialPhotoDryRun({ baseUrl, options, outputDir, runId, thresholds }) {
  return {
    baseUrl,
    dryRun: true,
    durationSeconds: options.durationSeconds,
    manifestPath: `${outputDir}/${runId}-manifest.json`,
    mix: E2E_SOCIAL_PHOTO_MIX,
    reportPaths: {
      json: `${outputDir}/${runId}-report.json`,
      markdown: `${outputDir}/${runId}-report.md`,
    },
    runId,
    scenario: "e2e-social-photo",
    storageUploadOptIn: options.allowStorageUpload,
    steps: E2E_SOCIAL_PHOTO_STEPS,
    targetPhotos: options.targetPhotos,
    targetPosts: options.targetPosts,
    thresholds,
    users: options.users,
    vus: options.vus,
  };
}

export async function runE2eSocialPhotoScenario({
  baseUrl,
  fetchImpl = fetch,
  manifest,
  options,
  record,
  timeoutMs,
}) {
  const dbSeed = await seedSyntheticAuthUsers({
    count: options.users,
    runId: manifest.runId,
  });
  manifest.records.userIds.push(...dbSeed.users.map(user => user.id));
  manifest.safeSessionTokenSuffixes.push(...dbSeed.safeSessionTokenSuffixes);

  await preflightSeededAuth({
    baseUrl,
    fetchImpl,
    timeoutMs,
    users: dbSeed.users,
  });

  await Promise.all(dbSeed.users.map(async (user) => {
    const csrf = await bootstrapCsrfForSession({
      baseUrl,
      fetchImpl,
      sessionCookieHeader: user.cookieHeader,
      timeoutMs,
    });
    user.writeHeaders = buildAuthedWriteHeaders({
      csrfSecret: csrf.csrfSecret,
      csrfToken: csrf.csrfToken,
      sessionCookieHeader: user.cookieHeader,
    });
  }));

  const fixture = createDeterministicImageFixture();
  const counters = {
    places: 0,
    posts: 0,
    publicReads: 0,
    readLoops: 0,
    s3Objects: 0,
    uploadedPhotos: 0,
  };
  const startedAt = performance.now();
  const endAt = startedAt + options.durationSeconds * 1000;

  await Promise.all(Array.from({ length: options.vus }, (_, workerIndex) =>
    runE2eWorker({
      baseUrl,
      counters,
      endAt,
      fetchImpl,
      fixture,
      manifest,
      options,
      record,
      timeoutMs,
      user: dbSeed.users[workerIndex % dbSeed.users.length],
      workerIndex,
    })));

  return counters;
}

async function runE2eWorker(input) {
  while (performance.now() < input.endAt) {
    const writeQuotaAvailable = input.counters.posts < input.options.targetPosts
      || input.counters.uploadedPhotos < input.options.targetPhotos;

    if (writeQuotaAvailable && shouldRunWriteJourney(input.counters)) {
      await runJourney(input);
      continue;
    }

    await runReadStep(input);
  }
}

function shouldRunWriteJourney(counters) {
  const total = counters.readLoops + counters.posts + counters.publicReads + counters.uploadedPhotos;
  if (total < 2)
    return true;

  return counters.uploadedPhotos / Math.max(1, total) < E2E_SOCIAL_PHOTO_MIX.photoUploads
    || counters.posts / Math.max(1, total) < E2E_SOCIAL_PHOTO_MIX.postPublishes;
}

async function runJourney(input) {
  const sequence = input.counters.uploadedPhotos + 1;
  const placeName = `${input.manifest.runId} Place ${input.workerIndex}-${sequence}`;
  const lat = 48.8566 + (sequence % 100) * 0.0001;
  const long = 2.3522 + (sequence % 100) * 0.0001;
  const authHeaders = input.user.writeHeaders ?? { cookie: input.user.cookieHeader };

  const created = await timedJsonRequest({
    authHeaders,
    baseUrl: input.baseUrl,
    body: {
      lat,
      locationAccuracy: 10,
      locationSource: "manual",
      long,
      placeName,
    },
    className: "write",
    fetchImpl: input.fetchImpl,
    method: "POST",
    name: "create_private_place_photo",
    path: "/api/place-photos/create-private",
    record: input.record,
    timeoutMs: input.timeoutMs,
  });

  input.counters.places += 1;
  rememberCreated(input.manifest, "locationIds", created.location?.id);
  rememberCreated(input.manifest, "locationLogIds", created.locationLog?.id);

  const upload = await performSignedS3Upload({
    authHeaders,
    baseUrl: input.baseUrl,
    fetchImpl: input.fetchImpl,
    fixture: input.fixture,
    record: input.record,
    signPath: created.upload.signUrl,
    storageUploadEnabled: input.options.allowStorageUpload,
    timeoutMs: input.timeoutMs,
  });
  input.counters.s3Objects += 1;
  rememberCreated(input.manifest, "s3ObjectKeys", upload.key);

  const image = await timedJsonRequest({
    authHeaders,
    baseUrl: input.baseUrl,
    body: {
      description: `${input.manifest.runId} load photo ${sequence}`,
      key: upload.key,
    },
    className: "write",
    fetchImpl: input.fetchImpl,
    method: "POST",
    name: "photo_metadata_write",
    path: created.upload.imageUrl,
    record: input.record,
    timeoutMs: input.timeoutMs,
  });
  input.counters.uploadedPhotos += 1;

  const visibilityPath = `/api/locations/${created.location.slug}/${created.locationLog.id}/images/${image.id}/visibility`;
  await timedJsonRequest({
    authHeaders,
    baseUrl: input.baseUrl,
    body: {
      locationAccuracy: 10,
      locationSource: "manual",
      publicLat: lat,
      publicLong: long,
      publicPlaceName: placeName,
      visibility: "public",
    },
    className: "write",
    fetchImpl: input.fetchImpl,
    method: "PATCH",
    name: "photo_visibility_public",
    path: visibilityPath,
    record: input.record,
    timeoutMs: input.timeoutMs,
  });

  const post = await timedJsonRequest({
    authHeaders,
    baseUrl: input.baseUrl,
    body: {
      caption: `${input.manifest.runId} load post ${sequence}`,
      locationLogImageId: image.id,
    },
    className: "write",
    fetchImpl: input.fetchImpl,
    method: "POST",
    name: "feed_post_publish",
    path: "/api/posts",
    record: input.record,
    timeoutMs: input.timeoutMs,
  });
  input.counters.posts += 1;
  rememberCreated(input.manifest, "postIds", post?.id);
}

async function runReadStep(input) {
  const authHeaders = input.workerIndex % 2 === 0 ? { cookie: input.user.cookieHeader } : {};
  const readSteps = [
    { name: "feed_read", path: "/api/feed?limit=20" },
    { name: "feed_read_cursor", path: "/api/feed?limit=20&cursor=999999999" },
    { name: "public_place_photos_read", path: "/api/public/place-photos?limit=25" },
    { name: "public_feed_globe_read", path: "/api/public/feed-globe?limit=100" },
  ];
  const step = readSteps[(input.counters.readLoops + input.workerIndex) % readSteps.length];
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(new URL(step.path, input.baseUrl), {
      headers: {
        "accept": "application/json",
        "user-agent": "WanderLog load runner",
        ...authHeaders,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    input.record(createMetricRecord({
      bytes: text.length,
      className: "read",
      durationMs: performance.now() - startedAt,
      method: "GET",
      name: step.name,
      ok: response.status >= 200 && response.status < 400,
      path: step.path,
      status: response.status,
    }));
  }
  catch (error) {
    input.record(createMetricRecord({
      className: "read",
      durationMs: performance.now() - startedAt,
      error: error?.name === "AbortError" ? "timeout" : String(error?.message || error),
      method: "GET",
      name: step.name,
      ok: false,
      path: step.path,
      status: 0,
      timedOut: error?.name === "AbortError",
    }));
  }
  finally {
    clearTimeout(timeout);
  }

  if (step.name.startsWith("public_"))
    input.counters.publicReads += 1;
  else
    input.counters.readLoops += 1;
}
