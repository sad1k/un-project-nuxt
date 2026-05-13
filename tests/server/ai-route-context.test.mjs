/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const contextSource = await readFile("lib/ai/route-context.ts", "utf8");
const promptSource = await readFile("lib/ai/route-prompts.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("selected route context re-reads user-owned personal context", () => {
  assert.match(contextSource, /buildSelectedRouteContext/);
  assert.match(contextSource, /userId: number/);
  assert.match(contextSource, /findExploreContextByUserId\(userId\)/);
  assert.match(contextSource, /selectedSavedPlaceIds/);
  assert.match(contextSource, /selectedDiaryLogIds/);
});

test("selected route context caps and truncates provider-bound data", () => {
  assert.match(contextSource, /MAX_SELECTED_SAVED_PLACES = 10/);
  assert.match(contextSource, /MAX_SELECTED_DIARY_LOGS = 10/);
  assert.match(contextSource, /MAX_SELECTED_CANDIDATE_PLACES = 12/);
  assert.match(contextSource, /MAX_DESCRIPTION_LENGTH = 240/);
  assert.match(contextSource, /slice\(0, MAX_SELECTED_SAVED_PLACES\)/);
  assert.match(contextSource, /slice\(0, MAX_SELECTED_DIARY_LOGS\)/);
  assert.match(contextSource, /slice\(0, MAX_SELECTED_CANDIDATE_PLACES\)/);
});

test("route prompt locks map-first route event behavior", () => {
  assert.match(promptSource, /ROUTE_SYSTEM_INSTRUCTIONS/);
  assert.match(promptSource, /raw JSON is not user-facing UI/);
  assert.match(promptSource, /selected sidebar context/);
  assert.match(promptSource, /single JSON object/);
  assert.match(promptSource, /Do not wrap output in markdown/);
  assert.match(promptSource, /preserve route variants/);
  assert.match(promptSource, /Never use numeric price levels/);
});

test("server env names include OpenAI route config without public runtime exposure", () => {
  assert.match(envSource, /OPENAI_API_KEY/);
  assert.match(envSource, /OPENAI_ROUTE_MODEL/);
  assert.match(envSource, /OPENAI_BASE_URL/);
  assert.doesNotMatch(envSource, /runtimeConfig\.public/);
});
