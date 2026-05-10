# Phase 5: Place Intelligence and Weather Tips - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 5-Place Intelligence and Weather Tips
**Areas discussed:** Popup content shape, Place data trust model, Community visit signals, Weather tips experience

---

## Popup Content Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Photo first | Lead the popup with place imagery when real photos are available. | yes |
| Review/rating first | Lead with rating, review snippets, and credibility signals. | |
| Practical details first | Lead with hours/cost/actions and route utility. | |
| Route rationale first | Lead with why the AI selected the place for this itinerary. | |

**User's choice:** Photo first; if data is missing, add a placeholder for missing data.
**Notes:** Missing popup sections should remain visible as placeholders instead of silently disappearing.

---

## Place Data Trust Model

| Option | Description | Selected |
|--------|-------------|----------|
| External provider data | Use provider-backed photos, reviews, ratings, and cost where available. | yes |
| WanderLog app data | Prefer saved places, diary logs, and app-owned photos/signals. | |
| AI-enriched summaries | Let AI summarize available place/route/provider/app data. | yes |
| Strict sourced-only display | Show only directly sourced fields; no AI enrichment. | |

**User's choice:** Yes to external/provider data and AI-enriched summaries.
**Notes:** Captured with the project safety rail that AI enrichment should summarize/support available data, not fabricate unsupported facts.

---

## Community Visit Signals

| Option | Description | Selected |
|--------|-------------|----------|
| Exact visit counts | Show precise WanderLog visit counts when available. | |
| Coarse buckets | Show ranges or labels to avoid false precision. | |
| Recent-window labels | Use recent app activity as a softer presence signal. | |
| Likely/currently there | Show best-effort likely/currently-there app signal when supported. | yes |

**User's choice:** Use likely/currently-there.
**Notes:** Captured with the standing constraint that community presence must not be fabricated and must be supported by app data.

---

## Weather Tips Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Route sidebar | Put route-wide and day-aware weather preparation tips in the sidebar. | yes |
| Place popups | Put weather guidance inside each place popup. | |
| Day checklist | Show a checklist per day of the route. | |
| Compact route panel | Show a small route-wide what-to-take panel only. | |

**User's choice:** Live in the route sidebar.
**Notes:** Sidebar is the primary surface. Place popups may only reference weather when locally relevant.

---

## the agent's Discretion

- Exact popup layout, placeholder copy, provider boundary, data schema split, and weather provider integration.
- Exact community-signal labels and thresholds, as long as likely/currently-there remains uncertainty-aware and app-data-supported.
- Whether enriched place intelligence is persisted or fetched/cached best-effort, subject to provider terms and privacy/security constraints.

## Deferred Ideas

- Interactive audio history/storytelling remains v2.
- Save-to-diary work remains Phase 6.
- Release hardening and full provider observability remain Phase 6, while Phase 5 preserves those constraints.
