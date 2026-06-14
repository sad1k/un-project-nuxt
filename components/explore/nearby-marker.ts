import type { ExploreNearbyPlace } from "~/lib/explore/nearby";

import { escapeHtml } from "~/components/explore/place-popup";
import { formatRouteDistance } from "~/lib/explore/route-map";

// Secondary dot marker for a discovered nearby place — deliberately lighter than
// the numbered route markers so suggestions never compete with an active route.
export function createNearbyMarkerElement(
  place: ExploreNearbyPlace,
  index: number,
  selected: boolean,
): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "26px",
    height: "26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  });
  el.ariaLabel = `Место рядом: ${place.name}`;

  const dot = document.createElement("div");
  Object.assign(dot.style, {
    width: selected ? "24px" : "20px",
    height: selected ? "24px" : "20px",
    borderRadius: "50%",
    background: "var(--explore-marker-current)",
    color: "var(--explore-primary-text)",
    fontWeight: "700",
    fontSize: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--explore-marker-border)",
    boxShadow: selected
      ? "0 0 0 5px color-mix(in srgb, var(--explore-info-text) 28%, transparent), 0 4px 12px var(--explore-marker-shadow)"
      : "0 0 0 3px color-mix(in srgb, var(--explore-info-text) 16%, transparent), 0 2px 8px var(--explore-marker-shadow)",
    transition: "width 140ms ease, height 140ms ease, box-shadow 140ms ease",
  });
  dot.textContent = (index + 1).toString();
  el.appendChild(dot);
  return el;
}

export function createNearbyPopupHTML(place: ExploreNearbyPlace): string {
  const distance = formatRouteDistance(place.distanceMeters ?? null);
  const meta = [place.categoryLabel, distance].filter(Boolean).join(" · ");
  const address = place.address
    ? `<div style="margin-top:4px;font-size:12px;color:var(--explore-text-soft);line-height:1.3;overflow-wrap:anywhere">${escapeHtml(place.address)}</div>`
    : "";

  return `
    <div style="padding:8px;min-width:160px;max-width:220px;font-family:system-ui,sans-serif">
      <div style="font-weight:600;font-size:14px;overflow-wrap:anywhere">${escapeHtml(place.name)}</div>
      <div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:var(--explore-info-text)">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--explore-marker-current);display:inline-block"></span>
        ${escapeHtml(meta)}
      </div>
      ${address}
    </div>
  `;
}
