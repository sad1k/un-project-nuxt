import antfu from "@antfu/eslint-config";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(antfu({
  type: "app",
  vue: true,
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
  ignores: [".omx/**", ".git/**", "**.docx", "**.png", "**.jpg", "**.jpeg", "**.gif", "**.bmp", "**.tiff", "**.ico", "**.webp", "**.svg", "**.puml", "**.dot", ".planning/**", ".pnpm-store/**", "AGENTS.md", "**/migrations/*", "**/dist/**", "**/node_modules/**", "**/public/**", "**/package-lock.json", "pnpm-lock.yaml", "**/.env", "**/.env.local", "**/.env.development", "**/.env.production", "**/*.md"],
}, {
  rules: {
    "vue/max-attributes-per-line": ["error", {
      singleline: {
        max: 2,
      },
      multiline: {
        max: 1,
      },
    }],
    "ts/no-redeclare": "off",
    "ts/consistent-type-definitions": ["error", "type"],
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "perfectionist/sort-imports": ["error", {
      tsconfigRootDir: ".",
    }],
    "unicorn/filename-case": ["error", {
      case: "kebabCase",
      ignore: ["README.md"],
    }],
  },
}));
