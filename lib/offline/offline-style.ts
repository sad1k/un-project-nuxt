import { buildOfflineTileUrl } from "./maplibre-protocol";

// Minimal MapLibre style targeting the Protomaps v4 vector schema.
// Hand-rolled (no @protomaps/basemaps dep) so the offline preview
// stays self-contained: water, land, roads, places, buildings. Good
// enough to confirm visually that the IDB-backed tiles render.

type StyleTheme = "light" | "dark";

type ColorPalette = {
  bg: string;
  earth: string;
  water: string;
  road: string;
  roadMinor: string;
  building: string;
  text: string;
  halo: string;
};

const PALETTES: Record<StyleTheme, ColorPalette> = {
  light: {
    bg: "#eef2f5",
    earth: "#f5efe3",
    water: "#a8c5dd",
    road: "#ffffff",
    roadMinor: "#f4e6c4",
    building: "#e5dccb",
    text: "#1f2937",
    halo: "#ffffff",
  },
  dark: {
    bg: "#050810",
    earth: "#0f172a",
    water: "#0c2440",
    road: "#cbd5e1",
    roadMinor: "#475569",
    building: "#1e293b",
    text: "#f8fafc",
    halo: "#020617",
  },
};

export function buildOfflineStyle(regionId: string, theme: StyleTheme = "dark"): Record<string, unknown> {
  const palette = PALETTES[theme];
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      offline: {
        type: "vector",
        tiles: [buildOfflineTileUrl(regionId)],
        minzoom: 0,
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": palette.bg },
      },
      {
        "id": "earth",
        "type": "fill",
        "source": "offline",
        "source-layer": "earth",
        "paint": { "fill-color": palette.earth },
      },
      {
        "id": "water",
        "type": "fill",
        "source": "offline",
        "source-layer": "water",
        "paint": { "fill-color": palette.water },
      },
      {
        "id": "buildings",
        "type": "fill",
        "source": "offline",
        "source-layer": "buildings",
        "minzoom": 13,
        "paint": { "fill-color": palette.building, "fill-opacity": 0.7 },
      },
      {
        "id": "roads-minor",
        "type": "line",
        "source": "offline",
        "source-layer": "roads",
        "filter": ["!=", ["get", "kind"], "highway"],
        "paint": {
          "line-color": palette.roadMinor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 1.4],
        },
      },
      {
        "id": "roads-highway",
        "type": "line",
        "source": "offline",
        "source-layer": "roads",
        "filter": ["==", ["get", "kind"], "highway"],
        "paint": {
          "line-color": palette.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 14, 3],
        },
      },
      {
        "id": "places",
        "type": "symbol",
        "source": "offline",
        "source-layer": "places",
        "minzoom": 4,
        "layout": {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 12, 14],
          "text-anchor": "center",
        },
        "paint": {
          "text-color": palette.text,
          "text-halo-color": palette.halo,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
