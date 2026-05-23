# Phase 12: Live Feed Globe and Photo Post Map Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 12-Live Feed Globe and Photo Post Map Layer
**Areas discussed:** Phase placement, publishing flow, feed globe surface, dense point behavior, coordinate privacy, visibility, popup content

---

## Phase Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New Phase 12 | Add a new phase after Phase 11 for live feed globe work. | yes |
| Extend Phase 10 | Fold globe/feed behavior into public place photo sharing. | |
| Capture only | Record the idea without updating roadmap. | |

**User's choice:** Phase 12.
**Notes:** The feature builds on Phase 10/11 but is a distinct social discovery surface.

---

## Publishing Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Quick feed button | Add a fast action for publishing an uploaded place photo to the feed. | yes |
| Auto-publish public photos | Every public place photo automatically becomes a feed/globe point. | |
| Separate channel choices | User chooses feed, globe, or both separately. | |

**User's choice:** Add a button for quick publication into the feed.
**Notes:** Publishing should remain explicit and authenticated.

---

## Feed Globe Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Live feed plus globe tab | Keep a live feed and add a tab for a wow-effect globe of created posts. | yes |
| Globe only | Focus only on the Mapbox globe. | |
| Full archive map | Use the tab as a complete map of all historical public posts. | |

**User's choice:** Live feed plus a tab for wow-effect viewing on the globe.
**Notes:** The globe is an experiential discovery mode, not a replacement for the feed.

---

## Dense Point Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cap only | Max 4 active points; newest replaces oldest. | |
| Cap plus overflow | Max 3-4 active points and show `+N` for hidden posts. | yes |
| Cluster by zoom | Use map clustering when zoomed out and live points when zoomed in. | |

**User's choice:** Cap plus overflow.
**Notes:** If a new point appears in a full radius, the oldest visible point should disappear/fade and the overflow indicator preserves awareness that more posts exist there.

---

## Coordinate Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Exact public coordinates | Use exact coordinates because globe photos are public. | yes |
| Blurred coordinates | Slightly blur locations for privacy. | |
| Mixed accuracy | Exact for attractions, blurred for arbitrary places. | |

**User's choice:** Exact public coordinates.
**Notes:** The user explicitly reasoned that all photos on the globe are public.

---

## Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Authenticated only | Only logged-in users can view the globe. | |
| Public for everyone | Guests and users can view the globe. | yes |
| Guests limited | Guests can view but need login for details. | |

**User's choice:** Public for everyone.
**Notes:** Publishing still requires authentication.

---

## Popup Content

| Option | Description | Selected |
|--------|-------------|----------|
| Lean public card | Photo, place, author, date. | yes |
| Social card | Photo, place, author, date, likes, comments. | |
| Preview only | Photo preview and click opens post. | |

**User's choice:** Photo, place, author, date.
**Notes:** Keep public popup metadata intentionally small and privacy-safe.

---

## the agent's Discretion

- Choose SSE, polling, or another app-friendly live update mechanism during planning.
- Choose the exact tab labels, route names, and component split.
- Choose the radius math and overflow rendering details as long as the visible behavior remains bounded to 3-4 active points.

## Deferred Ideas

- Full moderation/reporting UI.
- General feed push notifications.
- Follow graph, direct messaging, or personalized social ranking.
