/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");
const routePanelSource = await readFile("components/explore/route-panel.vue", "utf8");
const historySource = await readFile("components/explore/route-history.vue", "utf8");
const followUpSource = await readFile("components/explore/route-follow-up.vue", "utf8");
const pageSource = await readFile("pages/explore.vue", "utf8");

test("client route session composable consumes the app route stream", () => {
  assert.match(sessionSource, /\/api\/ai\/route/);
  assert.match(sessionSource, /activeVariantId/);
  assert.match(sessionSource, /generateRoute/);
  assert.match(sessionSource, /submitFollowUp/);
  assert.match(sessionSource, /setActiveVariant/);
  assert.doesNotMatch(sessionSource, /OPENAI_API_KEY/);
  assert.doesNotMatch(sessionSource, /OPENAI_ROUTE_MODEL/);
});

test("Explore primary route generation uses AI route session state", () => {
  assert.match(routePanelSource, /useAiRouteSession/);
  assert.match(routePanelSource, /generateRoute\(requestContext\.value\)/);
  assert.match(pageSource, /useAiRouteSession/);
  assert.match(pageSource, /activePoints/);
});

test("route history and follow-up expose variant switching and refinements", () => {
  assert.match(historySource, /setActiveVariant/);
  assert.match(historySource, /activeVariantId/);
  assert.match(followUpSource, /followUpMessage/);
  assert.match(followUpSource, /submitFollowUp/);
});

test("Explore route UI does not render raw event JSON", () => {
  for (const source of [routePanelSource, historySource, followUpSource]) {
    assert.doesNotMatch(source, /JSON\.stringify/);
    assert.doesNotMatch(source, /provider chunk/i);
  }
});
