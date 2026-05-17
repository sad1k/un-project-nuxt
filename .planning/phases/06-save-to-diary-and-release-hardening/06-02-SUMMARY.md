# 06-02 Summary: Saved-to-Diary Explore Status

**Status:** Complete

## Implemented

- Added diary-save summaries to route session restore snapshots.
- Added diary-save summaries to route session history polling.
- Extended client route session and global generation status types with diary-save state.
- Refreshed the active route snapshot after streaming completes so saved counts can appear without reloading the page.
- Added saved-to-diary status labels to the route history list and Explore route sidebar.

## Verification

- `node scripts/run-node-tests.mjs tests/server/route-diary-ui.test.mjs` passed.
- Included in `pnpm test:server` pass: 85/85 tests.

## Notes

- Live completed routes display "Saving to diary" until the post-stream restore returns persisted counts.
- Restored sessions and history cards display saved, partial, failed, or pending diary-save status.
