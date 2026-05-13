# Phase 4: Animated Map Route Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 4-Animated Map Route Experience
**Areas discussed:** Progressive route reveal, Day-by-day route control, Generated vs saved-place map language, Distance and leg details

---

## Progressive Route Reveal

| Option | Description | Selected |
|--------|-------------|----------|
| Point-by-point SSE reveal | Markers and route detail appear as route events arrive, reinforcing that generation is live and map-first. | yes |
| Completed-route reveal | Wait until the whole route variant is complete before drawing markers and lines. | |
| Hybrid zoom-aware reveal | Render points progressively but emphasize detailed line animation only when zoom/focus makes the line useful. | yes |

**User's choice:** Point by point as SSE events arrive; helpful when the user zooms close enough to see the route lines.
**Notes:** Locks a progressive route display. Planner should tie line-detail animation to useful zoom/focus rather than animating noisy route lines at global overview zoom.

---

## Day-by-Day Route Control

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented selector | Compact day selector for switching route sections. | yes |
| Timeline/list only | Day grouping lives primarily in the sidebar route list. | |
| Full route with emphasized day | Keep all days visible and visually emphasize the selected day. | |
| Isolated selected day | Selecting a day filters the map to that day or route section. | yes |

**User's choice:** Use a segmented selector. When a day is selected, isolate that section from the full route.
**Notes:** Locks a focused day-section interaction rather than only highlighting part of an always-visible full route.

---

## Generated vs Saved-Place Map Language

| Option | Description | Selected |
|--------|-------------|----------|
| Show generated route points only during route viewing | Keep the route map focused on AI-generated route points. | yes |
| Show saved places during route viewing | Display saved places alongside generated points on the map. | |
| Show user places during context selection | Saved/user places appear while picking route settings/context. | yes |
| Distinct current-location marker | If current location or user-owned points are displayed, style them differently from generated route markers. | yes |

**User's choice:** Show generated route points during route viewing. Show user/saved places while selecting route context in route settings. If the user's current location is shown, make it look different from other route points.
**Notes:** Prevents confusion between AI-generated route suggestions and user-owned context places.

---

## Distance and Leg Details

| Option | Description | Selected |
|--------|-------------|----------|
| On-map leg labels | Distance appears directly between route legs where available. | yes |
| Sidebar per-leg details | Sidebar lists distance per route leg. | yes |
| Sidebar route summary | Sidebar includes route-level total/summary distance. | yes |
| Selected-marker only | Distance is visible only when a marker is selected. | |

**User's choice:** Use on-map leg labels and the sidebar. Show per-leg distance and a summary in the sidebar.
**Notes:** Locks both visual map context and scannable sidebar detail. Missing estimates should degrade gracefully.

---

## the agent's Discretion

- Exact animation timing, easing, zoom threshold, and map-layer implementation.
- Exact visual styling for generated markers, current-location markers, route lines, and leg labels.
- Exact sidebar layout for distance summary and leg rows.

## Deferred Ideas

- Rich provider-backed place popups belong to Phase 5.
- Weather-aware tips belong to Phase 5.
- Save-to-diary persistence belongs to Phase 6.
