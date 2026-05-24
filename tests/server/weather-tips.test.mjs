/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const modelSource = await readFile("lib/explore/weather-tips.ts", "utf8").catch(() => "");
const endpointSource = await readFile("server/api/explore/weather-tips.get.ts", "utf8").catch(() => "");
const composableSource = await readFile("composables/use-route-weather-tips.ts", "utf8").catch(() => "");
const componentSource = await readFile("components/explore/route-weather-tips.vue", "utf8").catch(() => "");
const panelSource = await readFile("components/explore/route-panel.vue", "utf8");

test("TIPS-01 TIPS-02 D-11 D-12 D-13 weather model maps forecasts to practical sidebar tips", () => {
  assert.match(modelSource, /RouteWeatherTipsSchema/);
  assert.match(modelSource, /buildRouteWeatherTips/);
  assert.match(modelSource, /Зонт|Дождевой слой/);
  assert.match(modelSource, /Вода|Защита от солнца/);
  assert.match(modelSource, /Тёплый слой/);
  assert.match(modelSource, /осторожно, ветер/);
  assert.match(modelSource, /unavailable/);
  assert.doesNotMatch(modelSource, /\bfetch\(/);
  assert.doesNotMatch(modelSource, /process\.env/);
});

test("weather mapper handles precipitation heat cold wind severe codes missing data and days", () => {
  for (const token of [
    "precipitationProbabilityMax",
    "apparentTemperatureMax",
    "apparentTemperatureMin",
    "windSpeedMax",
    "weatherCode",
    "day",
    "multi-day",
  ]) {
    assert.match(modelSource, new RegExp(token));
  }
});

test("authenticated endpoint uses coordinate Open-Meteo forecast and degrades safely", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /api\.open-meteo\.com/);
  assert.match(endpointSource, /latitude/);
  assert.match(endpointSource, /longitude/);
  assert.match(endpointSource, /weather_code/);
  assert.match(endpointSource, /precipitation_probability_max/);
  assert.match(endpointSource, /apparent_temperature_max/);
  assert.match(endpointSource, /fetch/);
  assert.match(endpointSource, /createUnavailableRouteWeatherTips/);
});

test("client fetches route weather tips from route coordinates and caches context", () => {
  assert.match(composableSource, /useRouteWeatherTips/);
  assert.match(composableSource, /\/api\/explore\/weather-tips/);
  assert.match(composableSource, /points/);
  assert.match(composableSource, /selectedDays/);
  assert.match(composableSource, /cacheKey/);
  assert.doesNotMatch(composableSource, /GOOGLE_PLACES_API_KEY|OPENAI_API_KEY|TURSO_AUTH_TOKEN/);
});

test("route sidebar renders weather tips in the panel, not popups", () => {
  assert.match(componentSource, /Что взять/);
  assert.match(componentSource, /RouteWeatherTips/);
  assert.match(componentSource, /loading/);
  assert.match(componentSource, /unavailable/);
  assert.match(panelSource, /ExploreRouteWeatherTips/);
  assert.doesNotMatch(componentSource, /mapbox|popup/i);
});
