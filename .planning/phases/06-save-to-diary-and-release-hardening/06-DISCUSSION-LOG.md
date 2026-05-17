# Phase 6: Save to Diary and Release Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 6-Save to Diary and Release Hardening
**Areas discussed:** Route-to-diary shape, Place saving behavior, Diary UI placement, Hardening priority, Automatic diary save behavior

---

## Route-to-Diary Shape

| Option | Description | Selected |
|--------|-------------|----------|
| One trip/location with multiple logs | Create a route-level place/trip container and attach route points as logs. | |
| One log per route point | Each generated route point becomes a diary `locationLog`, with a created/reused matching `location`. | yes |
| Lightweight route summary plus selected entries | Persist route-level summary first and only create diary entries for selected points. | |

**User's choice:** "yes one lofr for route point"
**Notes:** Interpreted as one diary log for each generated route point, using existing diary structures.

---

## Place Saving Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Whole generated route | Save the entire completed generated route by default. | yes |
| Selected places only | User picks individual route places to save. | |
| Both with explicit review | Default to whole route but let users adjust selected places before saving. | |

**User's choice:** "save whole generated route"
**Notes:** Whole-route saving is the default phase behavior. Selected-place affordances are optional only if they reuse the same persistence path.

---

## Diary UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Route sidebar primary action | User starts diary save from the Explore sidebar. | |
| Per-place popup actions | User saves each place from rich generated-place popups. | |
| Route history/completed-session surface | Saved/completed route history carries the saved state. | yes |
| Combination | Saved state appears in both route sidebar and route history. | yes |

**User's choice:** "auto save the route to history"
**Notes:** Route history remains automatic. The saved diary state should be visible from route history and the route sidebar after completion.

---

## Hardening Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-user ownership tests | Prove users cannot read or modify one another's route or diary data. | |
| Public runtime config audit | Prove provider credentials are not exposed to browser runtime config. | |
| Sanitized Sentry/logging | Observe provider failures without raw prompts, provider headers, secrets, or private context. | yes |
| Full release checks | Run build, typecheck, lint, tests, and manual Explore checks. | yes |

**User's choice:** "sanitizes sentry logging build typecheck"
**Notes:** Sanitized Sentry/logging, build, and typecheck are locked as release-blocking Phase 6 concerns. Ownership and credential checks remain required by roadmap requirements and should still be planned.

---

## Automatic Diary Save Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit diary save | Route history is automatic, but diary entries are created only when the user clicks "Save route to diary." | |
| Automatic diary save | Completed generated routes automatically create diary records, with a way to review/delete afterward. | yes |
| Draft diary save | Completed routes create a draft/pending diary import, and the user confirms before it becomes normal diary content. | |

**User's choice:** "2"
**Notes:** Completed generated routes should automatically save into the diary. The implementation must be idempotent to avoid duplicate diary logs on retry, reload, or route-history restore.

---

## the agent's Discretion

- Exact automatic save trigger, reconciliation strategy, route-point description format, slug collision strategy, saved-state copy, and navigation/link placement are left to the agent/planner.
- The implementation must still satisfy user ownership, duplicate prevention, provider secrecy, sanitized observability, build, and typecheck requirements.

## Deferred Ideas

None.
