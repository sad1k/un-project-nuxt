import tailwindcss from "@tailwindcss/vite";

import env from "./lib/env";

// import "./lib/env";

const isDev = process.env.NODE_ENV !== "production";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  // Devtools eats ~500MB RAM — keep off by default, flip on when debugging.
  devtools: { enabled: false },

  modules: [
    // ESLint module runs a background linter that hogs RAM/CPU in dev.
    ...(isDev ? [] : ["@nuxt/eslint" as const]),
    "@nuxt/icon",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "@vee-validate/nuxt",
    "nuxt-csurf",
    "nuxt-maplibre",
    // Sentry is heavy on cold compile — disabled in dev for faster startup.
    ...(isDev ? [] : ["@sentry/nuxt/module" as const]),
    "nuxt-easy-lightbox",
    "vue-yandex-maps/nuxt",
    "@vite-pwa/nuxt",
  ],

  icon: {
    // Restrict server bundle to only the collections we actually use.
    // Drops icon bundle size dramatically and speeds up dev server compile.
    serverBundle: {
      collections: ["tabler", "logos"],
    },
  },

  routeRules: {
    // SSR is OFF on logged-in routes: no SEO value (personal content),
    // and SSR was waiting on session API + DB round-trip per request.
    // CSR with payload-driven auth boots faster.
    "/dashboard": { ssr: false },
    "/dashboard/**": { ssr: false },
    "/feed": { ssr: false },
    "/explore": { ssr: false },
    "/admin/**": { ssr: false },
  },

  build: {
    transpile: ["nuxt-maplibre"], // <------
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
    initializeOn: "onPluginInit",
  },

  nitro: {
    // Mark heavy SDKs as external — they won't be bundled by Nitro's rollup,
    // they load from node_modules at runtime. Massively cuts the server
    // bundle compile time (esbuild has less to chew through).
    externals: {
      external: [
        "@mistralai/mistralai",
        "@aws-sdk/client-s3",
        "@aws-sdk/s3-presigned-post",
        "@aws-sdk/s3-request-presigner",
        "@sentry/nuxt",
      ],
    },
  },

  vite: {

    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      // Pre-bundle heavy client deps once so Vite doesn't discover them
      // on first request and trigger a full re-optimize + page reload
      // (the #1 cause of multi-minute dev "stuck on optimizing").
      include: [
        "maplibre-gl",
        "mapbox-gl",
        "@indoorequal/vue-maplibre-gl",
        "vue-yandex-maps",
        "motion-v",
      ],
      // AWS SDK is server-only (used in nitro routes). Excluding stops
      // Vite from scanning its hundreds of ESM submodules on the client.
      exclude: [
        "@aws-sdk/client-s3",
        "@aws-sdk/s3-presigned-post",
        "@aws-sdk/s3-request-presigner",
      ],
    },
    server: {
      watch: {
        ignored: [
          "./docker-data/**",
          "**/local.db*",
          "**/node_modules/**",
          "**/.git/**",
          "**/.nuxt/**",
          "**/.output/**",
          // OMC/Claude/Codex write status & metrics every few seconds —
          // without these excludes Vite triggers a full page reload + plugins
          // recompile on every write, eventually OOM'ing node (the real 20-min hang).
          "**/.omx/**",
          "**/.claude/**",
          "**/.codex/**",
          "**.docx",
          "**.png",
          "**.jpg",
          "**.jpeg",
          "**.gif",
          "**.bmp",
          "**.tiff",
          "**.ico",
          "**.webp",
          "**.svg",
          "**.puml",
          "**.dot",
        ],
      },
      // Warmup is intentionally OFF in dev: warming `/` and `/feed` here
      // forces eager compile of FeedGlobe → full mapbox-gl graph at boot,
      // which dominated cold-start. Lazy on-demand compile is faster.
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
        "**/*.{js,css,html,svg,png,ico,webmanifest}",
      ],
      globIgnores: [
        "**/sw.js",
        "**/wanderlog-sw.js",
      ],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
    manifest: false,
    devOptions: {
      enabled: false,
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
});
