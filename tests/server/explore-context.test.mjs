/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const files = {
  candidatePlacesApi: "server/api/explore/candidate-places.get.ts",
  contextApi: "server/api/explore/context.get.ts",
  contextQuery: "lib/db/queries/explore-context.ts",
  contextSelector: "components/explore/context-selector.vue",
  requestContext: "composables/use-explore-context.ts",
};

async function readSource(file) {
  return await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
}

test("Explore context endpoint reads only authenticated user context", async () => {
  const source = await readSource(files.contextApi);

  assert.match(source, /defineAuthenticatedHandler/);
  assert.match(source, /findExploreContextByUserId\(event\.context\.user\.id\)/);
});

test("Explore context query shapes saved places and diary logs", async () => {
  const source = await readSource(files.contextQuery);

  assert.match(source, /savedPlaces/);
  assert.match(source, /diaryLogs/);
  assert.match(source, /eq\(location\.userId, userId\)/);
  assert.doesNotMatch(source, /process\.env/);
});

test("Explore request context carries selected personal and candidate context", async () => {
  const source = await readSource(files.requestContext);

  assert.match(source, /selectedSavedPlaceIds/);
  assert.match(source, /selectedDiaryLogIds/);
  assert.match(source, /candidatePlaces\.value\.filter\(place => place\.selected\)/);
  assert.match(source, /setCurrentLocation/);
});

test("Explore candidate places endpoint can fall back without provider results", async () => {
  const source = await readSource(files.candidatePlacesApi);

  assert.match(source, /URLSearchParams/);
  assert.match(source, /createFallbackCandidatePlaces/);
  assert.doesNotMatch(source, /console\.log/);
});

test("Explore panel exposes saved context and current location controls", async () => {
  const source = await readSource(files.contextSelector);

  assert.match(source, /\/api\/explore\/context/);
  assert.match(source, /useCurrentLocation/);
  assert.match(source, /toggleSavedPlace/);
  assert.match(source, /toggleDiaryLog/);
});
