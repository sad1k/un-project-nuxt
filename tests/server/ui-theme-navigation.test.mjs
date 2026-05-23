/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssSource = await readFile("assets/css/main.css", "utf8");
const navBarSource = await readFile("components/app/nav-bar.vue", "utf8");
const sideRailSource = await readFile("components/app/side-rail.vue", "utf8");
const routePanelSource = await readFile("components/explore/route-panel.vue", "utf8");
const explorePageSource = await readFile("pages/explore.vue", "utf8");
const mapboxSource = await readFile("composables/use-mapbox.ts", "utf8");
const globalSearchSource = await readFile("components/app/global-search.vue", "utf8");
const requestErrorNotificationsSource = await readFile("components/app/request-error-notifications.vue", "utf8");
const pwaStatusSource = await readFile("components/app/pwa-status.vue", "utf8");
const pwaInstallPromptSource = await readFile("components/app/pwa-install-prompt.vue", "utf8");
const themedShellSources = await Promise.all([
  "pages/index.vue",
  "pages/sign-in.vue",
  "pages/feed.vue",
  "pages/dashboard.vue",
  "pages/admin/route-generations.vue",
  "pages/admin/route-generation-detail.vue",
].map(path => readFile(path, "utf8")));

test("header chrome uses theme tokens and does not duplicate sidebar navigation tabs", () => {
  assert.match(cssSource, /--app-chrome-bg/);
  assert.match(cssSource, /--app-chrome-text/);
  assert.match(navBarSource, /app-chrome/);
  assert.match(globalSearchSource, /app-chrome-control/);
  assert.doesNotMatch(navBarSource, /navItems|v-for="item in navItems"|isActive\(item\.to\)/);
});

test("left sidebar can open as a themed drawer and expand labels", () => {
  assert.match(sideRailSource, /isDrawerOpen/);
  assert.match(sideRailSource, /openDrawer/);
  assert.match(sideRailSource, /tabler:menu-2/);
  assert.match(sideRailSource, /layout-sidebar-left-expand/);
  assert.match(sideRailSource, /app-chrome/);
});

test("explore route generation panel collapses instead of navigating away", () => {
  assert.match(routePanelSource, /isPanelCollapsed/);
  assert.match(routePanelSource, /togglePanelCollapsed/);
  assert.match(routePanelSource, /v-show="!isPanelCollapsed"/);
  assert.doesNotMatch(routePanelSource, /to="\/dashboard"/);
  assert.doesNotMatch(routePanelSource, /tabler:x/);
});

test("explore globe map responds to global color mode", () => {
  assert.match(mapboxSource, /MAP_THEME_STYLES/);
  assert.match(mapboxSource, /function setMapTheme/);
  assert.match(explorePageSource, /useColorMode/);
  assert.match(explorePageSource, /mapbox\.setMapTheme/);
});

test("global app notifications follow the active color mode", () => {
  assert.match(requestErrorNotificationsSource, /useColorMode/);
  assert.match(requestErrorNotificationsSource, /:theme="toasterTheme"/);
  assert.doesNotMatch(requestErrorNotificationsSource, /theme="dark"/);
  assert.match(pwaStatusSource, /app-chrome-strong/);
  assert.match(pwaInstallPromptSource, /app-chrome-strong/);
});

test("top-level route shells provide light and dark surfaces", () => {
  for (const source of themedShellSources) {
    assert.match(source, /dark:/);
    assert.doesNotMatch(source, /class="[^"]*(?<!dark:)bg-\[#050505\][^"]*(?<!dark:)text-white/);
    assert.doesNotMatch(source, /class="[^"]*(?<!dark:)bg-\[#000000\][^"]*(?<!dark:)text-white/);
  }
});
