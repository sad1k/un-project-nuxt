# Phase 3: AI Route Generation and Streaming - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 3-AI Route Generation and Streaming
**Areas discussed:** Conversation history and follow-ups, Streaming response shape, Personal context boundary, Structured route contract

---

## Conversation History and Follow-Ups

| Option | Description | Selected |
|--------|-------------|----------|
| Durable generated-route history | Store generated routes as route variants/history for a session. | yes |
| Latest active route only | Keep only the current route response. | |
| Ephemeral one-off generations | Do not persist route variants after generation. | |

**User's choice:** Store generated routes as history. During one session, the user should be able to switch between generated route variants if they changed a route point or preference.
**Notes:** Follow-up refinements should operate within the same route-planning session and preserve route variants for comparison/switching.

---

## Streaming Response Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Visible prose-first streaming | Show assistant text first, then structured route data at the end. | |
| Progressive internal route events | Stream structured route events internally so route points can appear gradually on the map. | yes |
| Final JSON only | Wait for final complete JSON before updating route UI. | |

**User's choice:** Route data should appear gradually as the generation progresses, but not as visible JSON or a default chat transcript.
**Notes:** The user clarified that the main UI should be map-first: points appear progressively on the route with animation. Raw JSON is server/client contract data only. User-visible content may be short place info or rationale. Chat is needed only for follow-up requests, changed preferences, or route edits.

---

## Personal Context Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar-selected context | User explicitly chooses route/personal context in the sidebar. | yes |
| Silent broad history | AI receives broader saved-place and diary history automatically. | |
| Minimal city/interests only | AI receives no personal context by default. | |

**User's choice:** AI context is chosen in the sidebar.
**Notes:** This preserves the Phase 2 decision that saved places and diary logs should be explicit and understandable rather than silently included.

---

## Structured Route Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Map-ready route points | Coordinates, day grouping, timing, rationale, confidence/alternatives, distances, optional price. | yes |
| Minimal map points | Coordinates and names only. | |
| Prose-only itinerary | Human-readable itinerary without structured map contract. | |

**User's choice:** Include coordinates, day grouping, estimated timing, rationale, confidence/alternative metadata, approximate distances, and price if cost estimation can be implemented responsibly.
**Notes:** Price/cost should be optional and source/confidence-aware. Rich provider-backed place costs still naturally fit Phase 5 if they require place-intelligence providers.

---

## the agent's Discretion

- Choose exact progressive event transport and route-event schema as long as raw JSON is not user-facing.
- Choose exact database schema split for route sessions, messages, generated variants, and route points.
- Choose provider/parser validation strategy while preserving server-only credentials and user-owned data boundaries.

## Deferred Ideas

- Final map animation/rendering belongs to Phase 4.
- Rich place intelligence and weather tips belong to Phase 5.
- Save-to-diary and release hardening belong to Phase 6.
