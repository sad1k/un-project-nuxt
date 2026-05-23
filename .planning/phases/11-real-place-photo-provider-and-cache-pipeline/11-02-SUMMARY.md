---
phase: 11-real-place-photo-provider-and-cache-pipeline
plan: 11-02
type: implementation-summary
status: complete
completed_at: "2026-05-22T11:32:31.000Z"
requirements_addressed:
  - REALPHOTO-01
  - REALPHOTO-02
  - REALPHOTO-03
  - REALPHOTO-04
  - REALPHOTO-05
  - REALPHOTO-06
---

# 11-02 Summary: Real Photo Source Chain

## Outcome

Implemented deterministic generated-route place photo resolution:

1. Fresh place media cache.
2. Public WanderLog place photos with bounded name/coordinate matching.
3. Google Places Photos through server-side fresh references.
4. Optional open provider fallback hook.
5. Explicit missing-photo result.

## Changed Files

| File | Purpose |
|------|---------|
| `lib/explore/place-media.ts` | Adds `resolveRealPlacePhoto` and real-photo-to-PlacePhoto conversion. |
| `lib/explore/place-intelligence-providers.ts` | Adds Google photo-specific resolution using existing Places search/details helpers. |
| `lib/db/queries/location-log-image.ts` | Adds safe public photo matching for generated place name/coordinates. |
| `lib/db/queries/place-media-cache.ts` | Used by the resolver for success/failure cache writes. |
| `server/api/explore/place-photo.get.ts` | Tightens Google photo resource-name validation and keeps media proxy short-lived/server-side. |
| `server/api/explore/place-intelligence.get.ts` | Wires real photo resolution into place intelligence enrichment. |
| `tests/server/place-media-resolution.test.mjs` | Verifies source priority, Google server boundary, missing fallback, and secret exposure constraints. |
| `tests/server/place-intelligence.test.mjs` | Verifies the endpoint consumes the real media resolver. |

## Decisions

- Public app photos outrank Google only when they are public, visible, coordinate-bounded, and name/confidence matched.
- Google photo URLs remain internal `/api/explore/place-photo` URLs; the client does not receive provider keys.
- The open-provider fallback is typed but intentionally no-op until Wikimedia/Foursquare config and terms are explicitly implemented.

## Verification

| Check | Result |
|-------|--------|
| `node scripts/run-node-tests.mjs tests/server/place-media-resolution.test.mjs tests/server/place-intelligence.test.mjs tests/server/place-popup-renderer.test.mjs tests/server/public-place-photos.test.mjs` | Passed as part of the 36-test Phase 11 focused suite. |
| Focused Phase 11 eslint | Passed for changed Phase 11 files. |

## Deviations

- No live Google provider call was made; behavior is covered through contract/source tests and existing provider adapter boundaries.

## Self-Check

- Required source order implemented: yes.
- Google media server-only: yes.
- Missing-photo state remains explicit: yes.

