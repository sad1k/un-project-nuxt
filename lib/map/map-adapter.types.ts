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
  duration?: number;
};

// FitBounds options
export type FitBoundsOptions = {
  padding?: number;
};

// The main adapter interface
export type MapAdapter = {
  map?: any;
  location?: { value: Record<string, unknown> };

  flyTo: (options: FlyToOptions) => Promise<void> | void;
  fitBounds: (bounds: MapBounds, options?: FitBoundsOptions) => Promise<void> | void;

  // Bounds factory
  createBounds: (sw: [number, number], ne: [number, number]) => MapBounds;

  // Lifecycle
  isReady: () => boolean;
};
