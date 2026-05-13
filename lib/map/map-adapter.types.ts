// Common map coordinates type
export type MapCoordinates = {
  lng: number;
  lat: number;
};

// Common bounds type
export type MapBounds = {
  extend: (coords: [number, number]) => MapBounds;
  _bounds?: unknown; // Internal bounds representation for map adapters
};

// FlyTo options
export type FlyToOptions = {
  center: [number, number];
  zoom: number;
  speed?: number;
};

// FitBounds options
export type FitBoundsOptions = {
  padding?: number;
};

// The main adapter interface
export type MapAdapter = {
  map?: any;
  location?: any; // Reactive location ref for vue-yandex-maps

  // Core map operations
  flyTo: (options: FlyToOptions) => void;
  fitBounds: (bounds: MapBounds, options?: FitBoundsOptions) => void;

  // Bounds factory
  createBounds: (sw: [number, number], ne: [number, number]) => MapBounds;

  // Lifecycle
  isReady: () => boolean;
};
