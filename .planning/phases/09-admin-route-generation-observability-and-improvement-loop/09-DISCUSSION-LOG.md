# Phase 9: Admin Route Generation Observability and Improvement Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 9-Admin Route Generation Observability and Improvement Loop
**Areas discussed:** Admin Access Boundary, Route Session Visibility, Failure Taxonomy

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Admin Access Boundary | Who can see and call admin surfaces: internal admin, user model role, env allowlist, or developer-only diagnostics. | yes |
| Route Session Visibility | What route-generation data admins can see per session. | yes |
| Failure Taxonomy | How route-generation failures are classified and explained. | yes |
| Improvement Loop Actions | Whether admin can retry/export/file issues from diagnostics. | no |

**User's choice:** `1, 2, 3`
**Notes:** Improvement actions were left for later discussion or planning discretion only where needed.

---

## Admin Access Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Env allowlist for admin email/user id | Fast internal admin boundary without changing the user model. | |
| Role in user model | Production-ready persisted authorization model. | yes |
| Developer-only diagnostics | Local/dev-only diagnostics without a production admin surface. | |
| Hybrid env allowlist now, role-ready later | Practical v1 that can evolve toward roles. | |

**User's choice:** Role in user model.
**Notes:** Admin authorization should be a real production path rather than a local diagnostics shortcut.

| Option | Description | Selected |
|--------|-------------|----------|
| Single `isAdmin` flag | Simplest boolean authorization model. | |
| `role: user | admin` | Small extensible role model. | yes |
| `role: user | admin | owner` | Adds an owner role for assigning admins. | |

**User's choice:** Add a `role` field.
**Notes:** Minimum v1 role values are `user | admin`.

| Option | Description | Selected |
|--------|-------------|----------|
| Database/manual seed | Assign the first admin manually in the database or seed path. | yes |
| Server-only bootstrap env | Promote a configured user from env on login. | |
| Admin UI for role management | Full role-management UI. | |

**User's choice:** Database/manual seed.
**Notes:** Role-management UI is explicitly out of scope for Phase 9.

---

## Route Session Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Operational metadata only | Status, failure code, provider/model, timings, counts, retry/stale/notification/diary state. | |
| Metadata plus sanitized request summary | Metadata plus city, days, interests, and selected-context counts. | |
| Metadata plus sanitized route snapshot | Adds generated route title, summary, point names, coordinates, and route quality fields. | yes |
| Raw diagnostics for admins | Raw prompts, model responses, provider headers, or event payloads. | |

**User's choice:** Metadata plus sanitized route snapshot.
**Notes:** Raw diagnostics remain prohibited even for admins.

| Option | Description | Selected |
|--------|-------------|----------|
| List metadata, detail route snapshot | Keep overview private/scannable and show route contents only on detail page. | yes |
| List includes compact snapshot | Expose route contents directly in the overview for faster quality scanning. | |
| Configurable reveal | Hide route contents in list until clicked or revealed. | |

**User's choice:** List metadata, detail route snapshot.
**Notes:** Route details should require an intentional transition/open action.

---

## Failure Taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Existing `failureCode` only | Fastest, but does not show where generation failed. | |
| Add `failureStage` plus normalized `failureCode` | Balanced stage/code model. | |
| Full diagnostic timeline | Stage start/finish/fail events with duration and retryability. | |
| Hybrid | Store/use stage and code, while using existing events/logs as timeline where available. | yes |

**User's choice:** Hybrid.
**Notes:** V1 stages should include `validation`, `provider`, `parsing`, `persistence`, `diary_save`, `notification`, and `unknown`. Admin UI should show stage, code, retryability, and a short safe explanation.

---

## the agent's Discretion

- Exact admin route paths and component split.
- Whether `failureStage` is stored directly, derived, or implemented through a small companion structure.
- Exact dashboard layout, provided it is operational, dense, scannable, and respects privacy.

## Deferred Ideas

- Admin role-management UI.
- Raw diagnostics access.
- Large new diagnostic event schema unless planning proves it is necessary.
- Admin actions such as retry, export, and issue filing.
