/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const contextTypeSource = await readFile("lib/explore/context.ts", "utf8");
const contractSource = await readFile("lib/ai/route-contract.ts", "utf8");
const routeContextSource = await readFile("lib/ai/route-context.ts", "utf8");
const promptSource = await readFile("lib/ai/route-prompts.ts", "utf8");
const mockSource = await readFile("lib/ai/mock-route-stream.ts", "utf8");
const userPointsSource = await readFile("composables/use-user-route-points.ts", "utf8");
const sessionSource = await readFile("composables/use-ai-route-session.ts", "utf8");
const controlSource = await readFile("components/explore/manual-points-control.vue", "utf8");

test("explore context models user anchor points as a first-class field", () => {
  assert.match(contextTypeSource, /export type ExploreAnchorPoint/);
  assert.match(contextTypeSource, /anchorPoints\?: ExploreAnchorPoint\[\]/);
});

test("route contract validates and optionally requires anchor points", () => {
  assert.match(contractSource, /const ExploreAnchorPointSchema = z\.object/);
  assert.match(contractSource, /anchorPoints: z\.array\(ExploreAnchorPointSchema\)/);
  // First generation is allowed from anchors alone, without a chosen city.
  assert.match(contractSource, /!value\.context\.anchorPoints\?\.length/);
});

test("selected route context forwards anchor points to the model", () => {
  assert.match(routeContextSource, /function getAnchorPoints/);
  assert.match(routeContextSource, /anchorPoints: getAnchorPoints\(requestContext\.anchorPoints\)/);
});

test("selected route context derives an explicit geographic scope from anchors", () => {
  assert.match(routeContextSource, /function getAnchorRegion/);
  assert.match(routeContextSource, /anchorRegion: getAnchorRegion\(requestContext\.anchorPoints\)/);
  // Bounds, centroid and a distance budget the model can actually respect.
  assert.match(routeContextSource, /bounds:/);
  assert.match(routeContextSource, /radiusMeters/);
  assert.match(routeContextSource, /maxDetourMeters/);
});

test("route prompt instructs enrichment around anchors instead of connecting them", () => {
  assert.match(promptSource, /selectedContext\.anchorPoints/);
  assert.match(promptSource, /MUST visit every anchor/);
  assert.match(promptSource, /Do NOT just connect the anchors/);
  assert.match(promptSource, /userAnchorPointCount/);
  // A fresh generation carrying a free-text wish stays a generate task.
  assert.match(promptSource, /task: request\.sessionId \? "refine_route_variant"/);
});

test("route prompt scopes the route to the anchor region, not the city centre", () => {
  assert.match(promptSource, /selectedContext\.anchorRegion/);
  assert.match(promptSource, /anchorRegion\.bounds/);
  assert.match(promptSource, /anchorRegion\.maxDetourMeters/);
  // The chosen city must not pull the route toward famous central sights.
  assert.match(promptSource, /routeConstraints\.city is ONLY a naming\/locale hint/);
});

test("dev mock honours anchor points so the feature is demoable without a key", () => {
  assert.match(mockSource, /function buildMockAnchorRoutePoints/);
  assert.match(mockSource, /request\.context\.anchorPoints/);
});

test("user route points composable maps a manual stop to an anchor", () => {
  assert.match(userPointsSource, /function toAnchorPoint/);
  assert.match(userPointsSource, /day: point\.day/);
});

test("route session threads anchors and a free-text wish through generation", () => {
  assert.match(sessionSource, /options\?: \{ followUpMessage\?: string \}/);
  assert.match(sessionSource, /contextPatch\?: Partial<ExploreRequestContext>/);
  assert.match(sessionSource, /\.\.\.contextPatch/);
});

test("manual points control exposes a free-text ask and sends anchors", () => {
  assert.match(controlSource, /data-testid="explore-manual-points-wish"/);
  assert.match(controlSource, /v-model="wish"/);
  assert.match(controlSource, /submitFollowUp\(message, \{ anchorPoints \}\)/);
  assert.match(controlSource, /followUpMessage: wish\.value/);
});
