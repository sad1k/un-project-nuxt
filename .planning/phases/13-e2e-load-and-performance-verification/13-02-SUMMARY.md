---
phase: 13-e2e-load-and-performance-verification
plan: 13-02
subsystem: load-testing
status: completed
completed: "2026-05-23"
key-files:
  created:
    - tests/load/lib/load-e2e-social-photo.mjs
    - tests/load/lib/load-s3-upload.mjs
    - tests/load/lib/load-image-fixture.mjs
  modified:
    - tests/load/run-load.mjs
    - tests/server/load-runner-source.test.mjs
requirements-completed:
  - TBD
---

# Phase 13 Plan 02: E2E Social Photo Scenario Summary

Implemented the balanced Phase 13 `e2e-social-photo` scenario that models custom place creation, signed S3-compatible image upload, metadata write, public visibility, feed publishing, and ongoing feed/public read traffic.

## What Changed

- Added deterministic tiny image fixture generation with SHA-256 checksum in the upload-compatible base64 format.
- Added S3-compatible signed upload helper using the app sign endpoint, `FormData`, separate upload timing, and explicit storage opt-in.
- Added `e2e-social-photo` scenario metadata and dry-run shape with:
  - 100 users
  - 100 virtual users
  - 1000 target photos
  - 1000 target posts
  - 600 second duration
- Implemented the real app journey:
  - `POST /api/place-photos/create-private`
  - `POST /api/locations/:slug/:id/sign-images`
  - signed S3-compatible upload
  - `POST /api/locations/:slug/:id/image`
  - `PATCH /api/locations/:slug/:id/images/:image-id/visibility`
  - `POST /api/posts`
- Added read pressure for:
  - `/api/feed?limit=20`
  - cursor feed reads
  - `/api/public/place-photos?limit=25`
  - `/api/public/feed-globe?limit=100`

## Decisions

- Kept storage-writing traffic blocked unless `LOAD_ENABLE_STORAGE_UPLOAD=1` or `--allow-storage-upload` is present.
- Combined create-place, upload, visibility, and feed publish into one journey operation while preserving sub-step metrics.
- Kept reads running during the write window rather than as setup-only traffic.

## Verification

- `node scripts/run-node-tests.mjs tests/server/load-runner-source.test.mjs` passed 7/7.
- `LOAD_ENABLE_STORAGE_UPLOAD=1 npm run load -- e2e-social-photo --dry-run` passed and shows storage upload opt-in as true.
- `npm run load:e2e:dry-run` passed and shows storage upload opt-in as false for the safe default dry-run script.
- Targeted ESLint for changed Phase 13 load files passed.

## Deviations from Plan

None - plan executed exactly as written.

## Next

Ready for Plan 13-03.
