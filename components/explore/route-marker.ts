import type { RouteMapPoint, RouteMarkerKind } from "~/lib/explore/route-map";

import { escapeHtml } from "~/components/explore/place-popup";

const MARKER_STYLES: Record<RouteMarkerKind, {
  background: string;
  borderRadius: string;
  boxShadow: string;
  label: string;
  text: string;
}> = {
  "generated": {
    background: "linear-gradient(135deg, #f87171, #f59e0b)",
    borderRadius: "50%",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    label: "Route stop",
    text: "",
  },
  "current-location": {
    background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
    borderRadius: "12px",
    boxShadow: "0 0 0 5px rgba(37,99,235,0.18), 0 2px 8px rgba(0,0,0,0.3)",
    label: "Your location",
    text: "You",
  },
  "user-place": {
    background: "linear-gradient(135deg, #10b981, #047857)",
    borderRadius: "8px",
    boxShadow: "0 0 0 4px rgba(16,185,129,0.16), 0 2px 8px rgba(0,0,0,0.3)",
    label: "Saved place",
    text: "P",
  },
};

let styleInjected = false;

function injectMarkerStyles() {
  if (styleInjected)
    return;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes markerDrop {
      0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
      60% { transform: translateY(4px) scale(1.05); opacity: 1; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

export function createMarkerElement(point: RouteMapPoint, index: number, delayMs: number): HTMLDivElement {
  injectMarkerStyles();
  const markerStyle = MARKER_STYLES[point.markerKind];

  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  });
  el.ariaLabel = `${markerStyle.label}: ${point.name}`;

  const marker = document.createElement("div");
  Object.assign(marker.style, {
    width: "32px",
    height: "32px",
    background: markerStyle.background,
    borderRadius: markerStyle.borderRadius,
    color: "white",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: point.markerKind === "current-location" ? "11px" : "14px",
    boxShadow: markerStyle.boxShadow,
    border: "2px solid white",
    animation: "markerDrop 0.5s ease-out",
    animationDelay: `${delayMs}ms`,
    animationFillMode: "both",
  });
  marker.textContent = point.markerKind === "generated" ? (index + 1).toString() : markerStyle.text;
  el.appendChild(marker);
  return el;
}

export function createPopupHTML(point: RouteMapPoint): string {
  const color = point.markerKind === "generated" ? "#f59e0b" : "#2563eb";
  const markerLabel = MARKER_STYLES[point.markerKind].label;
  return `
    <div style="padding:8px;min-width:150px;font-family:system-ui,sans-serif">
      <div style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color}20;color:${color};font-size:11px;font-weight:600;margin-bottom:4px">
        Day ${escapeHtml(point.day)}
      </div>
      <div style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(point.name)}</div>
      <div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:#6B7280">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
        ${escapeHtml(markerLabel)}
      </div>
    </div>
  `;
}
