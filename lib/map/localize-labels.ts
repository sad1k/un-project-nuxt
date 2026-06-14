// Localize all place/POI/road labels to Russian. The classic Mapbox styles used
// across the app (dark-v11, light-v11, outdoors-v12, satellite-streets-v12) are
// built on the Streets v8 tileset, which ships per-language name fields
// (name_ru, name_en, …). We swap each symbol layer's text-field to prefer
// name_ru and fall back to the local/default name where a translation is missing.
export const MAP_LABEL_LANGUAGE = "ru";

/**
 * Retarget every place/POI/road name label on a Mapbox GL map to {@link MAP_LABEL_LANGUAGE}.
 *
 * Must be called on every `style.load` — `map.setStyle()` rebuilds the layer set
 * from the remote style and discards any prior layout overrides.
 */
export function localizeMapLabels(map: any) {
  const layers = map.getStyle()?.layers ?? [];
  const localizedTextField = [
    "coalesce",
    ["get", `name_${MAP_LABEL_LANGUAGE}`],
    ["get", "name"],
  ];

  for (const layer of layers) {
    if (layer.type !== "symbol")
      continue;

    // Only retarget label layers that render a place/POI name. Layers keyed on
    // other fields (road shields via "ref", custom labels via "label", …) don't
    // contain "name" and are left untouched.
    const textField = layer.layout?.["text-field"];
    if (!textField || !JSON.stringify(textField).includes("name"))
      continue;

    try {
      map.setLayoutProperty(layer.id, "text-field", localizedTextField);
    }
    catch {
      // Some symbol layers reject text-field overrides (e.g. icon-only); skip them.
    }
  }
}
