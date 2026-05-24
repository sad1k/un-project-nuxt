import tailwindcss from "@tailwindcss/vite";

import env from "./lib/env";

// import "./lib/env";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },

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
  ],

  routeRules: {
    "/dashboard": { ssr: false },
    "/explore": { ssr: false },
  },

  build: {
    transpile: ["nuxt-maplibre"], // <------
  },

  css: ["mapbox-gl/dist/mapbox-gl.css", "~/assets/css/main.css"],

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

  vite: {

    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        "maplibre-gl",
      ],
    },
    server: {
      watch: {
        ignored: [
          "./docker-data/**",
          "**/local.db*",
        ],
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

  sourcemap: {
    client: "hidden",
  },

  devServer: {
    port: 3001,
  },
});
