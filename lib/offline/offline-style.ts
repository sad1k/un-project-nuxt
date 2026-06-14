import { buildOfflineTileUrl, OFFLINE_GLYPHS_URL } from "./maplibre-protocol";

// Minimal MapLibre style targeting the Protomaps v4 vector schema.
// Hand-rolled (no @protomaps/basemaps dep) so the offline preview
// stays self-contained: water, land, roads, places, buildings, and
// text labels (place / street / POI names) for orientation.
//
// Labels read the `name` fields already present in the downloaded vector
// tiles; the glyphs come from precached static PBFs served through the
// `offline-glyphs://` protocol (see maplibre-protocol.ts). We prefer
// Cyrillic (`name:ru`) then Latin (`name:en`) before the local-script
// `name`, so the bundled Latin+Cyrillic glyph ranges cover the common case
// and the protocol's empty-glyph fallback handles any other script.

// Single font stack we ship glyphs for — must match the folder under
// public/fonts/ and the {fontstack} token MapLibre puts in the glyph URL.
const LABEL_FONT = "notosans-regular";

// Russian-first label text: name:ru → name:en → local name.
const LABEL_TEXT_FIELD = ["coalesce", ["get", "name:ru"], ["get", "name:en"], ["get", "name"]];

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

export function buildOfflineStyle(regionId: string, theme: StyleTheme = "dark", maxZoom = 14): Record<string, unknown> {
  const palette = PALETTES[theme];
  return {
    version: 8,
    glyphs: OFFLINE_GLYPHS_URL,
    sources: {
      offline: {
        type: "vector",
        tiles: [buildOfflineTileUrl(regionId)],
        minzoom: 0,
        maxzoom: maxZoom,
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
      // Text labels for orientation. Glyphs resolve through the
      // `offline-glyphs://` protocol, which always returns a valid buffer
      // (empty on miss) so an unbundled script can never blank the map.
      {
        "id": "place-labels",
        "type": "symbol",
        "source": "offline",
        "source-layer": "places",
        "layout": {
          "text-field": LABEL_TEXT_FIELD,
          "text-font": [LABEL_FONT],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 14, 14, 16],
          "text-max-width": 8,
          "text-padding": 4,
        },
        "paint": {
          "text-color": palette.text,
          "text-halo-color": palette.halo,
          "text-halo-width": 1.4,
          "text-halo-blur": 0.4,
        },
      },
      {
        "id": "road-labels",
        "type": "symbol",
        "source": "offline",
        "source-layer": "roads",
        "minzoom": 13,
        "layout": {
          "symbol-placement": "line",
          "text-field": LABEL_TEXT_FIELD,
          "text-font": [LABEL_FONT],
          "text-size": 11,
          "symbol-spacing": 280,
        },
        "paint": {
          "text-color": palette.text,
          "text-halo-color": palette.halo,
          "text-halo-width": 1.2,
        },
      },
      {
        "id": "poi-labels",
        "type": "symbol",
        "source": "offline",
        "source-layer": "pois",
        "minzoom": 15,
        "layout": {
          "text-field": LABEL_TEXT_FIELD,
          "text-font": [LABEL_FONT],
          "text-size": 10,
          "text-max-width": 7,
          "text-padding": 3,
        },
        "paint": {
          "text-color": palette.text,
          "text-halo-color": palette.halo,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}
