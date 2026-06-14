/**
 * Post-build fix for a Nuxt/Nitro bug on Windows (Nuxt 3.17.x + Vite 6)
 * where Nitro silently fails to populate .output/public/.
 *
 * Steps:
 *  1. Copy built client assets  (.nuxt/dist/client/) → .output/public/
 *  2. Copy static source assets (public/)            → .output/public/
 *  3. Write the prerendered /offline/index.html shell if it is absent
 *  4. Run workbox injectManifest — AFTER step 3 so offline/index.html is
 *     included in the precache manifest
 *
 * Runs automatically via the "postbuild" npm script.
 */

import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_PUBLIC = join(ROOT, ".output/public");
const CLIENT_DIST = join(ROOT, ".nuxt/dist/client");
const SOURCE_PUBLIC = join(ROOT, "public");

// ─── helpers ─────────────────────────────────────────────────────────────────

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  }
  catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  let count = 0;
  for (const e of entries) {
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) {
      count += await copyDir(s, d);
    }
    else {
      await copyFile(s, d);
      count++;
    }
  }
  return count;
}

// ─── 1. client assets ────────────────────────────────────────────────────────

if (await pathExists(CLIENT_DIST)) {
  const n = await copyDir(CLIENT_DIST, OUT_PUBLIC);
  console.warn(`[fix-output-public] copied ${n} client assets → .output/public`);
}
else {
  console.warn("[fix-output-public] .nuxt/dist/client not found — skipping client assets");
}

// ─── 2. source public assets ─────────────────────────────────────────────────
// Copy everything from public/ EXCEPT wanderlog-sw.js — that is regenerated
// by workbox below so the precache manifest is always up to date.

async function copySourcePublic(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  let count = 0;
  for (const e of entries) {
    if (e.name === "wanderlog-sw.js")
      continue;
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) {
      count += await copySourcePublic(s, d);
    }
    else {
      await copyFile(s, d);
      count++;
    }
  }
  return count;
}

const n2 = await copySourcePublic(SOURCE_PUBLIC, OUT_PUBLIC);
console.warn(`[fix-output-public] copied ${n2} source public assets → .output/public`);

// ─── 3. /offline prerendered shell ───────────────────────────────────────────
// Written BEFORE workbox so offline/index.html is included in the precache.
// Find the Nuxt entry JS as the largest .js in _nuxt/ — the entry bundle is
// always the heaviest chunk. All real content on /offline is <ClientOnly> so
// the SSR output is a minimal shell that Vue hydrates on the client.

async function findEntryJs() {
  const dir = join(OUT_PUBLIC, "_nuxt");
  if (!await pathExists(dir))
    return null;
  const files = (await readdir(dir)).filter(f => extname(f) === ".js" && !f.endsWith(".map"));
  let best = null;
  let bestSize = 0;
  for (const f of files) {
    const s = await stat(join(dir, f));
    if (s.size > bestSize) {
      bestSize = s.size;
      best = f;
    }
  }
  return best; // largest JS = Nuxt app entry (always true for content-hashed builds)
}

async function findOfflineCss() {
  const dir = join(OUT_PUBLIC, "_nuxt");
  if (!await pathExists(dir))
    return null;
  const files = (await readdir(dir)).filter(f => f.startsWith("offline.") && f.endsWith(".css"));
  return files[0] ?? null;
}

const offlineHtml = join(OUT_PUBLIC, "offline", "index.html");

if (!await pathExists(offlineHtml)) {
  const [entryJs, offlineCss] = await Promise.all([findEntryJs(), findOfflineCss()]);
  await mkdir(join(OUT_PUBLIC, "offline"), { recursive: true });

  const preload = entryJs ? `<link rel="modulepreload" href="/_nuxt/${entryJs}">` : "";
  const css = offlineCss ? `<link rel="stylesheet" href="/_nuxt/${offlineCss}">` : "";
  const entry = entryJs ? `<script type="module" src="/_nuxt/${entryJs}"></script>` : "";

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Офлайн-карты — WanderLog</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0F766E">
<link rel="icon" href="/favicon.ico">
<link rel="manifest" href="/manifest.webmanifest">
${preload}
${css}
</head>
<body>
<div id="__nuxt"><div class="offline-shell"><div class="offline-shell__loading"><p>Загрузка офлайн-карт…</p></div></div></div>
<script>window.__NUXT__={data:{},state:{},_errors:{},serverRendered:true,config:{public:{s3BucketUrl:"",mapboxToken:"",routeNotificationVapidPublicKey:""},app:{baseURL:"/",buildAssetsDir:"/_nuxt/",cdnURL:""}}}</script>
${entry}
</body>
</html>`;

  await writeFile(offlineHtml, html);
  await writeFile(
    join(OUT_PUBLIC, "offline", "_payload.json"),
    JSON.stringify({ data: {}, state: {}, _errors: {}, serverRendered: true }),
  );
  console.warn(`[fix-output-public] wrote /offline shell (entry=${entryJs ?? "?"}, css=${offlineCss ?? "?"})`);
}
else {
  console.warn("[fix-output-public] /offline/index.html already exists — skipping");
}

// ─── 4. workbox injectManifest ───────────────────────────────────────────────
// Runs AFTER the offline shell is written so offline/index.html is included
// in the precache manifest.

try {
  const { injectManifest } = await import("workbox-build");
  const result = await injectManifest({
    swSrc: join(ROOT, "public/wanderlog-sw.js"),
    swDest: join(OUT_PUBLIC, "wanderlog-sw.js"),
    globDirectory: OUT_PUBLIC,
    globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,pbf}"],
    globIgnores: ["**/sw.js", "**/wanderlog-sw.js", "**/wanderlog-sw.mjs"],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  });
  console.warn(`[fix-output-public] SW: injected ${result.count} precache entries (${Math.round(result.size / 1024)} kB) → wanderlog-sw.js`);
}
catch (err) {
  console.warn("[fix-output-public] workbox injectManifest failed — copying source SW as fallback:", err.message);
  await copyFile(join(SOURCE_PUBLIC, "wanderlog-sw.js"), join(OUT_PUBLIC, "wanderlog-sw.js"));
}

console.warn("[fix-output-public] done ✓");
