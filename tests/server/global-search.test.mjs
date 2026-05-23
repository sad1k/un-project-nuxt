/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const endpointSource = await readFile("server/api/search/global.get.ts", "utf8");
const componentSource = await readFile("components/app/global-search.vue", "utf8");

test("global search endpoint returns Explore CTA and grouped results", () => {
  assert.match(endpointSource, /cta:\s*\{/);
  assert.match(endpointSource, /to:\s*"\/explore"/);
  assert.match(endpointSource, /key:\s*"places"/);
  assert.match(endpointSource, /key:\s*"users"/);
  assert.match(endpointSource, /key:\s*"routes"/);
});

test("global search endpoint searches places, users, and saved route sessions", () => {
  assert.match(endpointSource, /async function searchPlaces/);
  assert.match(endpointSource, /async function searchUsers/);
  assert.match(endpointSource, /async function searchRoutes/);
  assert.match(endpointSource, /from\(location\)/);
  assert.match(endpointSource, /from\(locationLog\)/);
  assert.match(endpointSource, /from\(user\)/);
  assert.match(endpointSource, /from\(aiRouteSession\)/);
  assert.match(endpointSource, /\/dashboard\/location\/\$\{place\.slug\}/);
  assert.match(endpointSource, /\/feed\?author=\$\{foundUser\.id\}/);
  assert.match(endpointSource, /\/explore\?sessionId=\$\{route\.sessionId\}/);
});

test("header search dropdown keeps Explore generator as the first selectable slot", () => {
  assert.match(componentSource, /const exploreCta = \{/);
  assert.match(componentSource, /title:\s*"Сгенерировать маршрут"/);
  assert.match(componentSource, /activeIndex\.value === 0/);
  assert.match(componentSource, /selectedItem\?\.to \?\? exploreCta\.to/);
  assert.match(componentSource, /<NuxtLink[\s\S]*:to="exploreCta\.to"/);
});

test("header search fetches global results and supports keyboard opening", () => {
  assert.match(componentSource, /\$fetch<GlobalSearchResponse>\("\/api\/search\/global"/);
  assert.match(componentSource, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(componentSource, /@keydown\.down\.prevent="moveActive\(1\)"/);
  assert.match(componentSource, /@submit\.prevent="selectActiveResult"/);
});
