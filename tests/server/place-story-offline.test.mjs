/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const composableSource = await readFile("composables/use-place-story.ts", "utf8");
const cardSource = await readFile("components/explore/place-story-card.vue", "utf8");
const serviceWorkerSource = await readFile("public/wanderlog-sw.js", "utf8");

test("story composable uses an explicit Cache API bucket for saved audio", () => {
  assert.match(composableSource, /wanderlog-place-story-audio-v1/);
  assert.match(composableSource, /saveOffline/);
  assert.match(composableSource, /removeOffline/);
  assert.match(composableSource, /checkOfflineAvailability/);
  assert.match(composableSource, /window\.caches\.open\(PLACE_STORY_AUDIO_CACHE_NAME\)/);
  assert.match(composableSource, /cacheStorage\.put\(createOfflineCacheRequest\(story\),\s*response\.clone\(\)\)/);
  assert.match(composableSource, /cacheStorage\.delete\(createOfflineCacheRequest\(story\)\)/);
});

test("offline playback only uses cached generated story audio and never queues generation", () => {
  assert.match(composableSource, /isBrowserOffline\(\)/);
  assert.match(composableSource, /markOfflineUnavailable/);
  assert.match(composableSource, /Story was not saved offline/);
  assert.match(composableSource, /cacheStorage\.match\(createOfflineCacheRequest\(story\)\)/);

  const offlineGuardIndex = composableSource.indexOf("if (isBrowserOffline())");
  const generationFetchIndex = composableSource.indexOf("/api/explore/place-story/generate");
  assert.ok(offlineGuardIndex >= 0, "offline guard should exist");
  assert.ok(generationFetchIndex > offlineGuardIndex, "offline guard should be checked before generation fetch");
});

test("story card exposes simple save remove and unavailable offline states", () => {
  for (const label of [
    "Не сохранено офлайн",
    "Сохраняем",
    "Доступно офлайн",
    "Удалить",
    "История не сохранена офлайн",
  ]) {
    assert.match(cardSource, new RegExp(label));
  }

  assert.match(cardSource, /handleOfflineAction/);
  assert.match(cardSource, /placeStory\.saveOffline/);
  assert.match(cardSource, /placeStory\.removeOffline/);
});

test("app service worker keeps story audio out of broad runtime caching", () => {
  assert.match(serviceWorkerSource, /push/);
  assert.match(serviceWorkerSource, /notificationclick/);
  assert.match(serviceWorkerSource, /\/api\/explore\/place-story\/audio/);
  assert.match(serviceWorkerSource, /shouldBypassRequest/);
  assert.doesNotMatch(serviceWorkerSource, /PLACE_STORY_AUDIO_CACHE_NAME/);
});
