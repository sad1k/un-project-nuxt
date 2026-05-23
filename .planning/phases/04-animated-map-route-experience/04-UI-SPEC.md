# Phase 4 UI-SPEC: Explore Map Route Experience

## Objective

Redesign the Explore page around the provided map-first reference: a full-screen dark map, compact navigation rail, glass header, and right-side AI route planner panel. Preserve existing route generation, route restore, map rendering, place story, weather tips, and diary-save status behavior.

## Layout Contract

- Explore remains a full-viewport, layout-free route at `/explore`.
- The map is the primary canvas. UI overlays must be translucent, compact, and pointer-scoped.
- Left rail: fixed 56px icon navigation with WanderLog mark, Explore active state, dashboard/feed links, and secondary icon actions.
- Top header: brand, search affordance, saved shortcut, and user pill. Header starts after the left rail.
- Right panel: 380px desktop AI route planner, top/right/bottom inset 16px, rounded 16px, dark glass surface, internal scrolling.
- Mobile/tablet: right panel becomes a bottom sheet constrained to 72vh and leaves the left rail visible.

## Visual Contract

- Base palette: `#050505` black, `#1f7877` emerald, `#f3d19e` gold, `#b03b60` sangria, white alpha text/borders.
- Map style: Mapbox dark style with a dark teal fog and non-dominant teal route line.
- Typography: Dela Gothic for compact brand/headline moments, Poiret One for numeric display accents, Inter for controls/body.
- Controls: chips, segmented controls, timeline rows, and icon buttons use 8-12px radius; no nested card stacks.
- Route list: vertical timeline with numbered stops and emerald-to-sangria line.

## Interaction Contract

- Dashboard must expose a visible transition to `/explore`.
- Explore controls continue feeding `useExploreContext()` and `useAiRouteSession()`.
- Do not show live/trending/location plaques unless they are backed by real product data.
- Duration UI updates `selectedDays`; transport mode is currently local display-only until the request contract supports it.
- Generate action remains disabled without a selected city or while generation is active.
- Completed route surfaces keep diary-save status, weather guidance, place story controls, route history, and follow-up refinement discoverable inside the panel.

## Verification Notes

- Run lint/typecheck/build or report existing blockers.
- Browser check `/dashboard` -> `/explore`, desktop and mobile widths.
- Confirm map is dark, route panel is readable, no text overlap, and Explore generation controls still bind to existing state.
