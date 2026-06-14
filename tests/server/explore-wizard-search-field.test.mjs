/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const wizardSource = await readFile("components/explore/wizard.vue", "utf8");

test("city search input is widened by dropping the empty side slots", () => {
  // Empty w-8 spacer slots are no longer reserved on the city step.
  assert.match(wizardSource, /currentStep !== 'city'/);
  // City input wrapper drops the extra px-1 inset (ends right after items-center).
  assert.match(wizardSource, /relative flex w-full items-center"/);
});

test("city search uses an animated rotating placeholder", () => {
  assert.match(wizardSource, /PLACEHOLDER_PHRASES/);
  assert.match(wizardSource, /Куда едем\?/);
  assert.match(wizardSource, /Город мечты\?/);
  assert.match(wizardSource, /name="placeholder-roll"/);
  assert.match(wizardSource, /explore-wizard-placeholder/);
  // Native placeholder attribute removed in favor of the overlay + a11y label.
  assert.doesNotMatch(wizardSource, /placeholder="Куда едем\?"/);
  assert.match(wizardSource, /aria-label="Поиск города"/);
});

test("placeholder rotation is cleaned up and respects reduced motion", () => {
  assert.match(wizardSource, /setInterval/);
  assert.match(wizardSource, /clearInterval/);
  assert.match(wizardSource, /prefers-reduced-motion: reduce/);
});
