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
    background: "var(--explore-marker-generated)",
    borderRadius: "50%",
    boxShadow: "0 0 0 6px color-mix(in srgb, var(--explore-primary-bg) 24%, transparent), 0 8px 24px var(--explore-marker-shadow)",
    label: "Точка маршрута",
    text: "",
  },
  "current-location": {
    background: "var(--explore-marker-current)",
    borderRadius: "12px",
    boxShadow: "0 0 0 5px color-mix(in srgb, var(--explore-info-text) 18%, transparent), 0 2px 8px var(--explore-marker-shadow)",
    label: "Ваше местоположение",
    text: "Вы",
  },
  "user-place": {
    background: "var(--explore-marker-user)",
    borderRadius: "8px",
    boxShadow: "0 0 0 4px color-mix(in srgb, var(--explore-primary-bg) 16%, transparent), 0 2px 8px var(--explore-marker-shadow)",
    label: "Сохранённое место",
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
    color: "var(--explore-primary-text)",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: point.markerKind === "current-location" ? "11px" : "14px",
    boxShadow: markerStyle.boxShadow,
    border: "1px solid var(--explore-marker-border)",
    animation: "markerDrop 0.5s ease-out",
    animationDelay: `${delayMs}ms`,
    animationFillMode: "both",
  });
  marker.textContent = point.markerKind === "generated" ? (index + 1).toString() : markerStyle.text;
  el.appendChild(marker);
  return el;
}

export function createPopupHTML(point: RouteMapPoint): string {
  const color = point.markerKind === "generated" ? "var(--explore-accent)" : "var(--explore-info-text)";
  const colorWash = `color-mix(in srgb, ${color} 18%, transparent)`;
  const markerLabel = MARKER_STYLES[point.markerKind].label;
  return `
    <div style="padding:8px;min-width:150px;font-family:system-ui,sans-serif">
      <div style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${colorWash};color:${color};font-size:11px;font-weight:600;margin-bottom:4px">
        День ${escapeHtml(point.day)}
      </div>
      <div style="font-weight:600;font-size:14px;margin-top:4px">${escapeHtml(point.name)}</div>
      <div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:var(--explore-text-soft)">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
        ${escapeHtml(markerLabel)}
      </div>
    </div>
  `;
}
