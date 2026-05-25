/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const promptSource = await readFile("composables/use-pwa-install-prompt.ts", "utf8");
const promptComponentSource = await readFile("components/app/pwa-install-prompt.vue", "utf8");
const statusSource = await readFile("components/app/pwa-status.vue", "utf8");
const layoutSource = await readFile("layouts/default.vue", "utf8");
const cssSource = await readFile("assets/css/main.css", "utf8");

test("install prompt composable captures browser install event and persists dismissal", () => {
  assert.match(promptSource, /beforeinstallprompt/);
  assert.match(promptSource, /event\.preventDefault\(\)/);
  assert.match(promptSource, /deferredInstallPrompt/);
  assert.match(promptSource, /canInstall/);
  assert.match(promptSource, /async function install/);
  assert.match(promptSource, /function dismiss/);
  assert.match(promptSource, /localStorage\.setItem\(INSTALL_DISMISSED_STORAGE_KEY,\s*"true"\)/);
});

test("install prompt UI is compact dismissible and mobile-shell focused", () => {
  assert.match(promptComponentSource, /Установить WanderLog/);
  assert.match(promptComponentSource, /Добавьте приложение на главный экран/);
  assert.match(promptComponentSource, /@click="install\(\)"/);
  assert.match(promptComponentSource, /@click="dismiss\(\)"/);
  assert.match(promptComponentSource, /tabler:device-mobile/);
});

test("PWA status UI reports offline shell honestly without unsupported claims", () => {
  assert.match(statusSource, /navigator\.onLine/);
  assert.match(statusSource, /serviceWorker/);
  assert.match(statusSource, /Офлайн-оболочка доступна/);
  assert.match(statusSource, /Для маршрутов, карт, дневника и AI нужна сеть/);
  assert.doesNotMatch(statusSource, /offline generation|edit offline|sync later/i);
});

test("default layout mounts PWA shell widgets once with safe-area spacing", () => {
  assert.equal((layoutSource.match(/<AppPwaStatus/g) || []).length, 1);
  assert.equal((layoutSource.match(/<AppPwaInstallPrompt/g) || []).length, 1);
  assert.match(layoutSource, /pwa-shell-stack/);
  assert.match(cssSource, /safe-area-inset-bottom/);
});
