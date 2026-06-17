import tailwindcss from "@tailwindcss/vite";

import env from "./lib/env";

// Heavy local-only directories (AI-tooling state, nested git worktrees, docker data).
// They must be excluded from Nuxt/Nitro/Vite scanning and file watching — otherwise the
// dev server crawls the full repo copies under .claude/worktrees and OOMs with
// multi-minute "Compiled X.mjs" rebuilds.
const IGNORED_PATHS = [
  "**/.claude/**",
  "**/.codex/**",
  "**/.omc/**",
  "**/docker-data/**",
  "**/local.db*",
];

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

  // Keep Nuxt's own file scanning/watching out of the heavy local-only dirs.
  ignore: IGNORED_PATHS,

  // Nitro builds the server bundle ("Compiled X.mjs"); without this it scans and watches
  // the nested .claude/worktrees repo copies and OOMs the dev server.
  nitro: {
    ignore: IGNORED_PATHS,
    watchOptions: {
      ignored: IGNORED_PATHS,
    },
  },

  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "@vee-validate/nuxt",
    "nuxt-csurf",
    "nuxt-maplibre",
    "@sentry/nuxt/module",
    "nuxt-easy-lightbox",
    "vue-yandex-maps/nuxt",
    "@vite-pwa/nuxt",
  ],

  routeRules: {
    "/dashboard": { ssr: false },
    "/dashboard/**": { ssr: false },
    "/feed": { ssr: false },
    "/explore": { ssr: false },
    "/admin/**": { ssr: false },
    // Prerender a static, network-free shell. The service worker serves this
    // document for offline navigations so the app cold-starts into the saved
    // offline maps (rendered client-side from IndexedDB).
    "/offline": { prerender: true },
  },

  build: {
    transpile: ["nuxt-maplibre"],
  },

  css: ["~/assets/css/main.css"],

  eslint: {
    config: {
      standalone: false,
    },
  },

  runtimeConfig: {
    public: {
      s3BucketUrl: env.S3_BUCKET_URL,
      sentryDsn: env.SENTRY_DSN,
      mapboxToken: env.MAPBOX_TOKEN,
      routeNotificationVapidPublicKey: env.ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY,
    },
  },

  yandexMaps: {
    apikey: env.YANDEX_MAPS_API_KEY,
    lang: "ru_RU",
    initializeOn: "onComponentMount",
  },

  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      // mapbox-gl and maplibre-gl both ship a UMD `dist/*.js` under a
      // `type: module` package, so served raw they parse as an ESM with no
      // exports and `module.default` is undefined (`X.Map is not a
      // constructor`). Neither imports its own CSS (we load that manually),
      // so it's safe to pre-bundle them here — esbuild gives each a real
      // default export. NOTE: keep maplibre-gl here, NOT in `exclude` — it is
      // UMD like mapbox-gl, not a real-ESM CSS dep like the ones below.
      include: [
        "mapbox-gl",
        "maplibre-gl",
      ],
      // CSS-shipping deps — let the browser load these natively so
      // their `*.css` imports go through Vite's regular middleware
      // (which sets Content-Type correctly) instead of the dep
      // optimizer (which can produce ESM URLs pointing at raw CSS).
      exclude: [
        "vue-easy-lightbox",
        "pmtiles",
      ],
    },
    server: {
      watch: {
        ignored: IGNORED_PATHS,
      },
    },
  },

  colorMode: {
    dataValue: "theme",
  },

  ssr: true,

  sentry: {
    org: "kirillov",
    project: "javascript-nuxt",
    autoInjectServerSentry: "top-level-import",
  },

  pwa: {
    registerType: "autoUpdate",
    strategies: "injectManifest",
    srcDir: "public",
    filename: "wanderlog-sw.js",
    injectManifest: {
      globPatterns: [
        // `pbf` covers the offline label glyph ranges under public/fonts/.
        "**/*.{js,css,html,svg,png,ico,webmanifest,pbf}",
      ],
      globIgnores: [
        "**/sw.js",
        "**/wanderlog-sw.js",
      ],
      manifestTransforms: [
        // The prerendered `/offline` route is emitted as BOTH `offline.html`
        // and `offline/index.html`. Workbox collapses both to the same
        // `/offline` cache key at runtime, throwing
        // `add-to-cache-list-conflicting-entries` and failing the service
        // worker install (status: redundant). Dedupe by the NORMALIZED route
        // URL (strip `index.html` / `.html` / trailing slash) — comparing raw
        // urls is not enough because the two collide only after normalization.
        (entries) => {
          const seen = new Set<string>();
          const manifest = entries.filter((entry) => {
            const key = entry.url.replace(/(?:index)?\.html$/, "").replace(/\/$/, "");
            if (seen.has(key))
              return false;
            seen.add(key);
            return true;
          });
          return { manifest, warnings: [] };
        },
      ],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
    manifest: false,
    devOptions: {
      // Dev-only: build & register the injectManifest SW so push/offline can be
      // tested on the dev server. The custom SW uses ESM workbox imports, so it
      // must be served as a module. Revert `enabled` to false for normal dev.
      enabled: true,
      type: "module",
      suppressWarnings: true,
    },
    client: {
      installPrompt: false,
    },
  },

  sourcemap: {
    client: "hidden",
  },

  devServer: {
    port: 3001,
  },

  alias: {
    ymaps3: "./node_modules/@yandex/ymaps3-types",
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        typeRoots: [
          "./node_modules/@types",
          "./node_modules/@yandex/ymaps3-types",
        ],
      },
    },
  },
});
