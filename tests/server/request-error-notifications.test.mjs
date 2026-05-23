/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const composableSource = await readFile("composables/use-request-error-notifications.ts", "utf8");
const pluginSource = await readFile("plugins/request-error-notifications.client.ts", "utf8");
const componentSource = await readFile("components/app/request-error-notifications.vue", "utf8");
const layoutSource = await readFile("layouts/default.vue", "utf8");

test("global request notification plugin wraps Nuxt request surfaces", () => {
  assert.match(pluginSource, /globalThis\.fetch\s*=\s*wrapNativeFetch/);
  assert.match(pluginSource, /Reflect\.set\(globalThis,\s*"\$fetch",\s*wrapOfetch/);
  assert.match(pluginSource, /Reflect\.set\(nuxtApp,\s*"\$csrfFetch",\s*csrfFetch\)/);
  assert.match(pluginSource, /shouldNotifyRequestFailure/);
});

test("request error notifications include a user report action", () => {
  assert.match(composableSource, /captureMessage\("User reported failed request"/);
  assert.match(composableSource, /toast\.error\("Запрос не выполнен"/);
  assert.match(composableSource, /id:\s*notification\.toastId/);
  assert.match(composableSource, /const groupKey = `\$\{method\}:\$\{requestLabel\}:\$\{statusCode \?\? "network"\}`/);
  assert.doesNotMatch(composableSource, /const groupKey = `\$\{input\.source\}/);
  assert.match(composableSource, /normalizeSameOriginRequestLabel/);
  assert.match(composableSource, /REQUEST_ERROR_SIGNAL_DEDUPE_MS/);
  assert.match(composableSource, /Повторилось \$\{notification\.count\} раз/);
  assert.match(composableSource, /label:\s*"Сообщить об ошибке"/);
  assert.match(componentSource, /Toaster/);
  assert.doesNotMatch(componentSource, /toast\("Event has been created"/);
  assert.doesNotMatch(componentSource, /sonner-toast-test-button/);
  assert.doesNotMatch(componentSource, /request-error-test-button/);
  assert.doesNotMatch(componentSource, /import\\.meta\\.dev/);
  assert.match(componentSource, /vue-sonner\/style\.css/);
});

test("default layout mounts global request error notifications", () => {
  assert.match(layoutSource, /<AppRequestErrorNotifications\s*\/>/);
  assert.match(layoutSource, /<ClientOnly>/);
});
