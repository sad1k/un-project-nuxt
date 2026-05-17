# 06-01 Summary: Idempotent Automatic Route-to-Diary Persistence

**Status:** Complete

## Implemented

- Added `routeDiarySave` metadata to link AI route sessions, variants, route points, diary locations, and diary logs.
- Added idempotent route-point reservation with a unique `(userId, sessionId, variantId, routePointId)` constraint.
- Added `saveCompletedRouteToDiary` to re-read a completed route through authenticated user ownership before creating diary records.
- Reused or created user-owned `location` records, then created one `locationLog` per generated route point.
- Wired the route generation runner to automatically save completed variants to diary after completion is persisted.

## Verification

- `node scripts/run-node-tests.mjs tests/server/route-diary-save.test.mjs` passed.
- Included in `pnpm test:server` pass: 85/85 tests.

## Notes

- Diary-save failures are recorded per route point as metadata and do not make the successful route generation fail.
- Existing generated route history remains the route-level history; this plan adds diary links for the generated route points.
