---
status: complete
slug: header-global-search
completed_at: "2026-05-23"
---

# Summary

Completed header global search with grouped results for saved places, users, and generated route sessions, plus a first-slot `/explore` route generation CTA.

## Changed

- Added `server/api/search/global.get.ts` for grouped search results.
- Rebuilt `components/app/global-search.vue` into an interactive dropdown with Ctrl/Cmd+K, keyboard selection, loading, empty, and error states.
- Added `tests/server/global-search.test.mjs` to lock the search contract.

## Verification

- Passed: `node scripts/run-node-tests.mjs tests/server/global-search.test.mjs`
- Passed: `pnpm exec eslint components/app/global-search.vue server/api/search/global.get.ts tests/server/global-search.test.mjs`
- Passed: focused TypeScript diagnostics for the new endpoint and component.
- Blocked: `pnpm typecheck` still fails on pre-existing unrelated type errors in files such as `components/animated-list.vue`, `components/app/yndx-map.client.vue`, `components/feed/post-card.vue`, and other existing areas.
