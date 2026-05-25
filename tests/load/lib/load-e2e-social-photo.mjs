import { performance } from "node:perf_hooks";

import { preflightSeededAuth, seedSyntheticAuthUsers } from "./load-auth-seed.mjs";
import { pickCityCoordinates } from "./load-cities.mjs";
import { bootstrapCsrfForSession, buildAuthedWriteHeaders } from "./load-csrf.mjs";
import { createDeterministicImageFixture } from "./load-image-fixture.mjs";
import { createMetricRecord } from "./load-metrics.mjs";
import { rememberCreated } from "./load-run-manifest.mjs";
import { performSignedS3Upload, timedJsonRequest } from "./load-s3-upload.mjs";

export const E2E_SOCIAL_PHOTO_TARGETS = Object.freeze({
  durationSeconds: 600,
  postDelayMs: 0,
  targetComments: 2000,
  targetLikes: 5000,
  targetPhotos: 1000,
  targetPosts: 1000,
  users: 100,
  vus: 100,
});

export const E2E_SOCIAL_PHOTO_MIX = Object.freeze({
  comments: 0.10,
  customPlaceCreates: 0.10,
  feedReads: 0.30,
  likes: 0.20,
  photoUploads: 0.20,
  postPublishes: 0.15,
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
  { className: "write", method: "POST", name: "post_like_create", path: "/api/posts/:id/like" },
  { className: "write", method: "POST", name: "post_comment_create", path: "/api/posts/:id/comments" },
  { className: "read", method: "GET", name: "feed_read", path: "/api/feed?limit=20" },
  { className: "read", method: "GET", name: "public_place_photos_read", path: "/api/public/place-photos?limit=25" },
  { className: "read", method: "GET", name: "public_feed_globe_read", path: "/api/public/feed-globe?limit=100" },
]);

const COMMENT_TEMPLATES = Object.freeze([
  "Love this place!",
  "Looks amazing — adding to my bucket list",
  "Great shot, what time of day was this?",
  "I was here last year, brings back memories",
  "Where exactly is this?",
  "Stunning view!",
  "On my route next month",
  "How was the weather?",
  "Reminds me of a similar spot",
  "Beautiful, thanks for sharing",
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
    postDelayMs: options.postDelayMs,
    storageUploadOptIn: options.allowStorageUpload,
    steps: E2E_SOCIAL_PHOTO_STEPS,
    targetComments: options.targetComments,
    targetLikes: options.targetLikes,
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
      csrfCookieName: csrf.csrfCookieName,
      csrfSecret: csrf.csrfSecret,
      csrfToken: csrf.csrfToken,
      sessionCookieHeader: user.cookieHeader,
    });
  }));

  const fixture = createDeterministicImageFixture();
  const counters = {
    comments: 0,
    likes: 0,
    places: 0,
    posts: 0,
    publicReads: 0,
    readLoops: 0,
    s3Objects: 0,
    uploadedPhotos: 0,
  };
  const sharedState = {
    postPool: manifest.records.postIds,
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
      sharedState,
      timeoutMs,
      user: dbSeed.users[workerIndex % dbSeed.users.length],
      users: dbSeed.users,
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
      if (input.options.postDelayMs > 0 && performance.now() < input.endAt) {
        const remainingMs = input.endAt - performance.now();
        await new Promise(resolve => setTimeout(resolve, Math.min(input.options.postDelayMs, remainingMs)));
      }
      continue;
    }

    const social = pickSocialAction(input.counters, input.options, input.sharedState.postPool);
    if (social === "like") {
      await runLikeStep(input);
      continue;
    }
    if (social === "comment") {
      await runCommentStep(input);
      continue;
    }

    await runReadStep(input);
  }
}

function totalOperations(counters) {
  return counters.readLoops + counters.posts + counters.publicReads
    + counters.uploadedPhotos + counters.likes + counters.comments;
}

function shouldRunWriteJourney(counters) {
  const total = totalOperations(counters);
  if (total < 2)
    return true;

  return counters.uploadedPhotos / Math.max(1, total) < E2E_SOCIAL_PHOTO_MIX.photoUploads
    || counters.posts / Math.max(1, total) < E2E_SOCIAL_PHOTO_MIX.postPublishes;
}

function pickSocialAction(counters, options, postPool) {
  if (!postPool || postPool.length === 0)
    return "read";

  const total = Math.max(1, totalOperations(counters));
  const likesUnderQuota = counters.likes < options.targetLikes
    && counters.likes / total < E2E_SOCIAL_PHOTO_MIX.likes;
  const commentsUnderQuota = counters.comments < options.targetComments
    && counters.comments / total < E2E_SOCIAL_PHOTO_MIX.comments;

  if (likesUnderQuota && commentsUnderQuota)
    return counters.likes <= counters.comments * 2 ? "like" : "comment";
  if (likesUnderQuota)
    return "like";
  if (commentsUnderQuota)
    return "comment";

  return "read";
}

async function runJourney(input) {
  const sequence = input.counters.uploadedPhotos + 1;
  const location = pickCityCoordinates(input.workerIndex, sequence);
  const placeName = `${input.manifest.runId} ${location.placeName}`;
  const lat = location.lat;
  const long = location.long;
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

function pickPostFromPool(pool, workerIndex, sequence) {
  if (pool.length === 0)
    return null;

  const index = (workerIndex * 13 + sequence * 17) % pool.length;
  return pool[index];
}

async function runLikeStep(input) {
  const postId = pickPostFromPool(input.sharedState.postPool, input.workerIndex, input.counters.likes + 1);
  if (postId === null || postId === undefined)
    return;

  const authHeaders = input.user.writeHeaders ?? { cookie: input.user.cookieHeader };

  try {
    await timedJsonRequest({
      authHeaders,
      baseUrl: input.baseUrl,
      className: "write",
      fetchImpl: input.fetchImpl,
      method: "POST",
      name: "post_like_create",
      path: `/api/posts/${postId}/like`,
      record: input.record,
      timeoutMs: input.timeoutMs,
    });
    rememberCreated(input.manifest, "likedPostIds", postId);
  }
  catch {
    // Already recorded as a failed metric inside timedJsonRequest. A 4xx here
    // is non-fatal: duplicate like, deleted post, or stale id from the pool.
  }
  finally {
    input.counters.likes += 1;
  }
}

async function runCommentStep(input) {
  const sequence = input.counters.comments + 1;
  const postId = pickPostFromPool(input.sharedState.postPool, input.workerIndex, sequence);
  if (postId === null || postId === undefined)
    return;

  const authHeaders = input.user.writeHeaders ?? { cookie: input.user.cookieHeader };
  const template = COMMENT_TEMPLATES[sequence % COMMENT_TEMPLATES.length];

  try {
    const comment = await timedJsonRequest({
      authHeaders,
      baseUrl: input.baseUrl,
      body: {
        content: `${template} ${input.manifest.runId} ${input.workerIndex}-${sequence}`,
      },
      className: "write",
      fetchImpl: input.fetchImpl,
      method: "POST",
      name: "post_comment_create",
      path: `/api/posts/${postId}/comments`,
      record: input.record,
      timeoutMs: input.timeoutMs,
    });
    rememberCreated(input.manifest, "commentIds", comment?.id);
  }
  catch {
    // Non-fatal: stale post id, validation rejection, etc. Metric was recorded.
  }
  finally {
    input.counters.comments += 1;
  }
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
