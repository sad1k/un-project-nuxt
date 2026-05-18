/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const popupSource = await readFile("components/explore/place-popup.ts", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const pageSource = await readFile("pages/explore.vue", "utf8");
const panelSource = await readFile("components/explore/route-panel.vue", "utf8");
const cardSource = await readFile("components/explore/place-story-card.vue", "utf8");
const composableSource = await readFile("composables/use-place-story.ts", "utf8");

test("place popup exposes a compact story CTA without becoming an audio player", () => {
  assert.match(popupSource, /includeStoryCta/);
  assert.match(popupSource, /data-place-story-cta/);
  assert.match(popupSource, /Listen to story/);
  assert.doesNotMatch(popupSource, /\bnew Audio\(/);
  assert.doesNotMatch(popupSource, /player-pause|progressSeconds|durationSeconds/);
});

test("map popup CTA focuses the route sidebar story card through selected route point state", () => {
  assert.match(mapboxSource, /onStoryRequest/);
  assert.match(mapboxSource, /bindStoryPopupAction/);
  assert.match(mapboxSource, /querySelector\?\.\("\[data-place-story-cta\]"\)/);
  assert.match(pageSource, /explore-selected-story-route-point-id/);
  assert.match(pageSource, /selectedStoryRoutePointId\.value = point\.sourceId/);
  assert.match(pageSource, /createPlacePopupHTML\(intelligence,\s*\{ includeStoryCta: true \}\)/);
});

test("route panel owns the selected story card and route point selection", () => {
  assert.match(panelSource, /ExplorePlaceStoryCard/);
  assert.match(panelSource, /selectedStoryPoint/);
  assert.match(panelSource, /selectedStoryRoutePointId/);
  assert.match(panelSource, /@click="selectedStoryRoutePointId = point\.sourceId"/);
  assert.match(panelSource, /:session-id="aiRouteSession\.sessionId\.value"/);
  assert.match(panelSource, /:variant-id="aiRouteSession\.activeVariantId\.value"/);
});

test("story card has basic explicit-tap player states but no selector or long reading UI", () => {
  for (const label of ["Listen to story", "Preparing story", "Pause", "Resume", "Replay"]) {
    assert.match(cardSource, new RegExp(label));
  }

  assert.match(cardSource, /progressPercent/);
  assert.match(cardSource, /handlePrimaryAction/);
  assert.match(cardSource, /Audio narration is AI-generated/);
  assert.doesNotMatch(cardSource, /transcript/i);
  assert.doesNotMatch(cardSource, /voice selector|language selector|speed/iu);
});

test("story composable uses app endpoints and HTMLAudioElement only after user action", () => {
  assert.match(composableSource, /usePlaceStory/);
  assert.match(composableSource, /\/api\/explore\/place-story/);
  assert.match(composableSource, /\/api\/explore\/place-story\/generate/);
  assert.match(composableSource, /async function togglePlayback/);
  assert.match(composableSource, /async function generateAndPlay/);
  assert.match(composableSource, /new Audio\(sourceUrl\)/);
  assert.match(composableSource, /resolvePlaybackUrl/);
  assert.doesNotMatch(composableSource, /OPENAI_API_KEY|S3_SECRET_KEY|audio\/speech/);

  const firstAudioIndex = composableSource.indexOf("new Audio");
  const generateIndex = composableSource.indexOf("async function generateAndPlay");
  assert.ok(firstAudioIndex > generateIndex, "audio element should be created inside the explicit playback flow");
});
