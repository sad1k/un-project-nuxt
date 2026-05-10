---
phase: 03
slug: ai-route-generation-and-streaming
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` |
| **Config file** | none |
| **Quick run command** | `node scripts/run-node-tests.mjs tests/server` |
| **Full suite command** | `pnpm verify:explore-foundation` |
| **Estimated runtime** | ~30-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/run-node-tests.mjs tests/server`
- **After every plan wave:** Run `pnpm verify:explore-foundation`
- **Before `$gsd-verify-work`:** Full suite must be green, or unrelated lint/typecheck blockers must be named with exact output.
- **Max feedback latency:** 90 seconds for focused tests.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | AIROUTE-06 | T-03-01 / T-03-04 | Route events cannot persist without schema validation | unit/source | `node scripts/run-node-tests.mjs tests/server/ai-route-contract.test.mjs` | W0 | pending |
| 03-01-02 | 01 | 1 | AIROUTE-05 | T-03-02 | Route sessions/variants are user-owned | source/unit | `node scripts/run-node-tests.mjs tests/server/ai-route-persistence.test.mjs` | W0 | pending |
| 03-01-03 | 01 | 1 | AIROUTE-05 | T-03-03 | Schema changes are pushed before verification | command | `pnpm exec drizzle-kit push` | W0 | pending |
| 03-02-01 | 02 | 2 | AIROUTE-01, AIROUTE-02 | T-03-04 | Provider stream is normalized into app route events | unit/source | `node scripts/run-node-tests.mjs tests/server/ai-route-stream.test.mjs` | W0 | pending |
| 03-02-02 | 02 | 2 | AIROUTE-03 | T-03-02 / T-03-05 | Only selected context is summarized for provider prompt | unit/source | `node scripts/run-node-tests.mjs tests/server/ai-route-context.test.mjs` | W0 | pending |
| 03-03-01 | 03 | 3 | AIROUTE-04, AIROUTE-05 | T-03-06 | Follow-ups preserve route variants and active variant switching | source | `node scripts/run-node-tests.mjs tests/server/ai-route-client.test.mjs` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers this phase:

- `scripts/run-node-tests.mjs` discovers `.test.mjs` files.
- `package.json` has `test:server` and `verify:explore-foundation`.
- Existing `tests/server/explore-*.test.mjs` demonstrate source/pure-helper test style.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route progress appears as user-friendly state, not raw JSON | AIROUTE-02 | Browser UI rendering is not covered by server source tests | Start dev server, submit route context, confirm progress/points/status render without raw JSON payload text. |
| Follow-up control is discoverable but not the primary first-run UI | AIROUTE-04 | Interaction ergonomics need browser review | Generate a route, submit a follow-up, confirm previous variant remains accessible. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-10

