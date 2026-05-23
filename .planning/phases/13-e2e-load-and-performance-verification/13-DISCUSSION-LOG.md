# Phase 13: E2E Load and Performance Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-23T07:54:02+03:00
**Phase:** 13-E2E Load and Performance Verification
**Areas discussed:** Phase boundary, performance metrics, photo upload path, synthetic users, cleanup policy, load mix

---

## Phase Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| New Phase 13 | Add a dedicated load/performance phase after Phase 12. | yes |
| Extend Phase 12 release blockers | Treat load testing as additional Phase 12 verification. | |

**User's choice:** New Phase 13.
**Notes:** The phase should cover e2e load testing for photo uploads, feed post publishing, custom places, and ordinary feed requests.

---

## Target Environment and Scale

| Option | Description | Selected |
|--------|-------------|----------|
| Local DB | Run against local database-backed deployment. | yes |
| Staging | Run against a shared or staging environment. | |
| Production-like | Run against production-like services. | |

**User's choice:** Local DB with 100 users, 1000 photos, and 1000 posts over 10 minutes.
**Notes:** Storage upload remains real S3-compatible in a later decision.

---

## Performance Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Practical local baseline | read p95 <= 800ms, write p95 <= 1500ms, error rate <= 1%, timeout rate <= 0.5%. | yes |
| Strict release gate | read p95 <= 500ms, write p95 <= 1000ms, error rate <= 0.5%, timeout rate <= 0.1%. | |
| Measure only | Collect metrics without fail thresholds in the first version. | |

**User's choice:** Practical local baseline.
**Notes:** User explicitly asked to fix request timings and the necessary metrics for performance evaluation.

---

## Photo Upload Path

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic local upload metadata | Create small test image records in local DB without real storage upload. | |
| Full S3-compatible upload opt-in | Exercise signed upload, binary storage upload, and app metadata write. | yes |
| Two modes | Synthetic by default and full S3 through explicit opt-in. | |

**User's choice:** Full S3-compatible upload opt-in.
**Notes:** This keeps the test close to the real user path, while planning must document storage safety.

---

## Synthetic Users

| Option | Description | Selected |
|--------|-------------|----------|
| Seed directly into local DB | Create synthetic Better Auth-compatible users and sessions in the local DB. | yes |
| Use real auth endpoints | Register/login through the app auth flow. | |
| One user, 100 VU | Reuse one authenticated session for all virtual users. | |

**User's choice:** Seed directly into local DB.
**Notes:** The goal is stable local multi-user load without OAuth instability.

---

## Data Retention and Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Always cleanup by runId | Automatically remove all synthetic DB rows and S3 objects after the run. | |
| Preserve data for diagnostics | Keep data after runs; cleanup is a separate command. | yes |
| Hybrid | Cleanup after success, preserve after failure, separate cleanup command available. | |

**User's choice:** Preserve data for diagnostics.
**Notes:** Cleanup still needs to be implemented as an explicit run-id command.

---

## Load Mix

| Option | Description | Selected |
|--------|-------------|----------|
| Balanced social/photo mix | 40% feed reads, 25% photo uploads, 20% post publishes, 10% custom place creates, 5% public/globe reads. | yes |
| Write-heavy stress | 35% photo uploads, 30% post publishes, 20% custom places, 15% reads. | |
| Read-heavy feed stress | 70% feed/public/globe reads, 15% photo uploads, 10% post publishes, 5% custom places. | |

**User's choice:** Balanced social/photo mix.
**Notes:** Planner may tune scheduling to hit the exact 1000 photo and 1000 post totals inside the 10-minute run.

---

## the agent's Discretion

- Exact script decomposition is left to planning.
- Exact report file format is left to planning, but must include per-step timings and threshold checks.

## Deferred Ideas

- Production/staging load testing.
- Browser-based visual e2e load.
- Product changes such as moderation, ranking, or quota UI.
