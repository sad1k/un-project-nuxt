# Server Test Pattern

Phase 1 establishes a focused server/data test lane without adding dependencies.

## Scope

- Place focused server and data tests under `tests/server/`.
- Name test files `*.test.mjs`.
- Use Node's built-in `node:test` and `node:assert/strict` modules.
- Prefer testing validation, data transformation, query ownership rules, and handler helpers before broad UI coverage.

## Boundaries

- Do not read `.env` or secret-bearing files.
- Do not call real external providers or the public network.
- Mock provider boundaries with local fixtures or built-in test doubles.
- Keep tests narrow enough that future Explore/AI phases can run them quickly.

## Command

```powershell
npm run test:server
```

The runner exits successfully when no `*.test.mjs` files exist yet, so the verification lane is usable before Phase 2 adds the first focused tests.
