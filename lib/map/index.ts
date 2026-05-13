import { createMaplibreAdapter } from "./maplibre-adapter";

export type {
  FitBoundsOptions,
  FlyToOptions,
  MapAdapter,
  MapBounds,
  MapCoordinates,
} from "./map-adapter.types";

export { createMaplibreAdapter } from "./maplibre-adapter";

export const defaultMapAdapterFactory = createMaplibreAdapter;
