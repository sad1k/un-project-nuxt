/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile("lib/ai/route-contract.ts", "utf8");

test("route contract exports map-ready request and event schemas", () => {
  assert.match(source, /RouteGenerationRequestSchema/);
  assert.match(source, /RoutePointSchema/);
  assert.match(source, /RouteEventEnvelopeSchema/);
  assert.match(source, /route\.point\.added/);
  assert.match(source, /route\.variant\.completed/);
});

test("route points validate coordinates, days, timing, distance, and rationale", () => {
  assert.match(source, /lat: z\.number\(\)\.min\(-90\)\.max\(90\)/);
  assert.match(source, /long: z\.number\(\)\.min\(-180\)\.max\(180\)/);
  assert.match(source, /day: z\.number\(\)\.int\(\)\.min\(1\)\.max\(14\)/);
  assert.match(source, /estimatedDurationMinutes: z\.number\(\)\.int\(\)\.min\(15\)\.max\(720\)/);
  assert.match(source, /approximateDistanceMeters: z\.number\(\)\.int\(\)\.min\(0\)/);
  assert.match(source, /rationale: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(500\)/);
});

test("cost metadata stays optional but confidence and source are required when priced", () => {
  assert.match(source, /estimatedPriceLevel/);
  assert.match(source, /priceConfidence/);
  assert.match(source, /priceSource/);
  assert.match(source, /Для оценки стоимости нужны метаданные уверенности/);
  assert.match(source, /Для оценки стоимости нужны метаданные источника/);
});

test("route contract stays detached from Vue, browser fetch, and server env", () => {
  assert.doesNotMatch(source, /\bref\(/);
  assert.doesNotMatch(source, /\bcomputed\(/);
  assert.doesNotMatch(source, /\bfetch\(/);
  assert.doesNotMatch(source, /process\.env/);
});
