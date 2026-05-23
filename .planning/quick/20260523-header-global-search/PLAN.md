---
status: complete
slug: header-global-search
created_at: "2026-05-23"
---

# Quick Task: Header Global Search

Implement the header search as a real global search surface for saved places, users, and generated route sessions. Keep the first dropdown slot as a visually prominent action that opens `/explore` so users can generate a travel route.

## Scope

- Add a global search API returning grouped place, user, and route results.
- Keep authenticated personal results scoped to the current user.
- Replace the passive header input with a dropdown, keyboard navigation, loading/error/empty states, and `/explore` CTA.
- Add focused regression coverage for the endpoint/component contract.

## Verification

- `node scripts/run-node-tests.mjs tests/server/global-search.test.mjs`
- `pnpm exec eslint components/app/global-search.vue server/api/search/global.get.ts tests/server/global-search.test.mjs`
- Focused TypeScript diagnostics on `server/api/search/global.get.ts` and `components/app/global-search.vue`
- `pnpm typecheck` attempted; blocked by existing unrelated project errors outside this quick task.
