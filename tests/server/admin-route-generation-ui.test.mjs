/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const listPageSource = await readFile("pages/admin/route-generations.vue", "utf8");
const detailPageSource = await readFile("pages/admin/route-generation-detail.vue", "utf8");
const userMenuSource = await readFile("components/app/user-menu.vue", "utf8");
const sideRailSource = await readFile("components/app/side-rail.vue", "utf8");
const mobileToolbarSource = await readFile("components/app/mobile-toolbar.vue", "utf8");
const authStoreSource = await readFile("stores/auth.ts", "utf8");

test("admin list page calls admin route-generation API and renders operational filters", () => {
  assert.match(listPageSource, /\/api\/admin\/route-generations/);
  assert.match(listPageSource, /filters\.status/);
  assert.match(listPageSource, /filters\.failureStage/);
  assert.match(listPageSource, /filters\.failureCode/);
  assert.match(listPageSource, /retryability/);
  assert.match(listPageSource, /safeExplanation/);
  assert.match(listPageSource, /generationStartedAt/);
  assert.match(listPageSource, /notificationStatus/);
  assert.match(listPageSource, /diarySave/);
});

test("admin overview keeps route contents behind intentional detail navigation", () => {
  assert.match(listPageSource, /\/admin\/route-generation-detail\?sessionId=\$\{session\.sessionId\}/);
  assert.match(listPageSource, /candidatePlaceCount/);
  assert.doesNotMatch(listPageSource, /point\.name|coordinates\.lat|coordinates\.long|routePointId/);
});

test("admin detail page renders sanitized route snapshot and safe timeline fields", () => {
  assert.match(detailPageSource, /\/api\/admin\/route-generations\/\$\{sessionId\.value\}/);
  assert.match(detailPageSource, /route\.query\.sessionId/);
  assert.match(detailPageSource, /Sanitized route snapshot/);
  assert.match(detailPageSource, /point\.name/);
  assert.match(detailPageSource, /point\.coordinates\.lat/);
  assert.match(detailPageSource, /point\.coordinates\.long/);
  assert.match(detailPageSource, /point\.confidence/);
  assert.match(detailPageSource, /point\.approximateDistanceMeters/);
  assert.match(detailPageSource, /Safe event timeline/);
  assert.match(detailPageSource, /validationStatus/);
});

test("admin UI and navigation do not expose raw diagnostics or role-management surfaces", () => {
  for (const source of [listPageSource, detailPageSource]) {
    assert.doesNotMatch(source, /requestContextJson|payloadJson|providerBodyPreview|Authorization|raw prompt|raw model/i);
    assert.doesNotMatch(source, /manage roles|role management|edit role|users\/roles/i);
  }

  assert.match(authStoreSource, /role\?: "user" \| "admin"/);
  assert.doesNotMatch(listPageSource, /authStore\.user\?\.role === "admin"|const isAdmin/);
  assert.doesNotMatch(detailPageSource, /authStore\.user\?\.role === "admin"|const isAdmin/);
  assert.match(listPageSource, /isForbidden/);
  assert.match(detailPageSource, /isForbidden/);
  assert.match(userMenuSource, /authStore\.user\?\.role === "admin"/);
  assert.match(sideRailSource, /authStore\.user\?\.role === "admin"/);
  assert.match(userMenuSource, /\/admin\/route-generations/);
  assert.match(sideRailSource, /\/admin\/route-generations/);
  assert.doesNotMatch(mobileToolbarSource, /\/admin\/route-generations/);
});
