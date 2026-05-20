import type { RouteLeg, RouteMapPoint } from "~/lib/explore/route-map";

import { createPlacePopupLoadingHTML } from "~/components/explore/place-popup";
import { createMarkerElement, createPopupHTML } from "~/components/explore/route-marker";

const ROUTE_LINE_LAYER_ID = "explore-route-line";
const ROUTE_LINE_SOURCE_ID = "explore-route-line";
const ROUTE_LEG_LABEL_LAYER_ID = "explore-route-leg-labels";
const ROUTE_LEG_LABEL_SOURCE_ID = "explore-route-leg-labels";
const ROUTE_DETAIL_ZOOM = 10;
const MAPBOX_DIRECTIONS_MAX_WAYPOINTS = 25;
const MAPBOX_DIRECTIONS_PROFILE = "walking";

// Module-level shared state so all components share the same instance.
const mapInstance = shallowRef<any>(null);
const mapLoaded = ref(false);
const activeMarkers: any[] = [];
let activeRoutePopup: any = null;
let mapboxModule: any = null;
let mapboxAccessToken = "";
let animationFrameId: number | null = null;
let spinTimeoutId: ReturnType<typeof setTimeout> | null = null;
let spinning = true;
let routeGeometryRequestId = 0;

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, any>>;
};

type RoutePopupOptions = {
  getPopupHTML?: (point: RouteMapPoint) => Promise<string> | string;
  onStoryRequest?: (point: RouteMapPoint) => void;
};

async function getMapboxGL() {
  if (!mapboxModule) {
    mapboxModule = await import("mapbox-gl");
  }
  return mapboxModule.default || mapboxModule;
}

async function fetchMapboxRoadRouteCoordinates(points: RouteMapPoint[]) {
  if (points.length > MAPBOX_DIRECTIONS_MAX_WAYPOINTS)
    return [];

  const waypointPath = points
    .map(point => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(";");
  const params = new URLSearchParams({
    access_token: mapboxAccessToken,
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "false",
  });
  const url = `https://api.mapbox.com/directions/v5/mapbox/${MAPBOX_DIRECTIONS_PROFILE}/${waypointPath}?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok)
      return [];

    const payload = await response.json() as {
      routes?: Array<{
        geometry?: {
          coordinates?: unknown;
        };
      }>;
    };
    const coordinates = payload.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates))
      return [];

    return coordinates.filter(isLngLatCoordinate);
  }
  catch {
    return [];
  }
}

function isLngLatCoordinate(input: unknown): input is [number, number] {
  return Array.isArray(input)
    && input.length >= 2
    && typeof input[0] === "number"
    && typeof input[1] === "number"
    && Number.isFinite(input[0])
    && Number.isFinite(input[1]);
}

function isValidRouteMapPoint(point: RouteMapPoint) {
  return Number.isFinite(point.lng)
    && Number.isFinite(point.lat)
    && point.lng >= -180
    && point.lng <= 180
    && point.lat >= -90
    && point.lat <= 90;
}

export function useMapbox() {
  async function initMap(container: HTMLElement, token: string) {
    if (mapInstance.value) {
      mapInstance.value.remove();
      mapInstance.value = null;
      mapLoaded.value = false;
    }

    const mb = await getMapboxGL();
    mb.accessToken = token;
    mapboxAccessToken = token;

    const map = new mb.Map({
      container,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "globe",
      pitch: 45,
      bearing: -17.6,
      center: [30, 15],
      zoom: 1.5,
    });

    map.addControl(new mb.NavigationControl(), "bottom-right");

    map.on("style.load", () => {
      map.setFog({
        "color": "rgb(255, 245, 235)",
        "high-color": "rgb(255, 220, 180)",
        "horizon-blend": 0.08,
        "space-color": "rgb(15, 15, 30)",
        "star-intensity": 0.6,
      });
      mapLoaded.value = true;
    });

    map.on("error", (e: any) => {
      console.error("[useMapbox] map error:", e.error?.message || e);
    });

    if (map.isStyleLoaded()) {
      mapLoaded.value = true;
    }

    function startSpin() {
      if (!spinning)
        return;
      animationFrameId = requestAnimationFrame(() => {
        if (!map || !spinning)
          return;
        const center = map.getCenter();
        center.lng += 0.005;
        map.setCenter(center);
        startSpin();
      });
    }

    map.on("idle", () => {
      if (map.getZoom() < 4 && spinning) {
        startSpin();
      }
    });

    map.on("zoomend", syncRouteDetailVisibility);
    map.on("moveend", syncRouteDetailVisibility);

    const pauseSpin = () => {
      spinning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (spinTimeoutId)
        clearTimeout(spinTimeoutId);
      spinTimeoutId = setTimeout(() => {
        spinning = true;
        if (map.getZoom() < 4)
          startSpin();
      }, 3000);
    };

    map.on("mousedown", pauseSpin);
    map.on("touchstart", pauseSpin);
    map.on("wheel", pauseSpin);

    mapInstance.value = map;
  }

  function clearMarkers() {
    activeRoutePopup?.remove();
    activeRoutePopup = null;
    activeMarkers.forEach(marker => marker.remove());
    activeMarkers.length = 0;
  }

  async function addMarkers(points: RouteMapPoint[], options: RoutePopupOptions = {}) {
    clearMarkers();
    const map = mapInstance.value;
    const mb = await getMapboxGL();
    if (!map)
      return;

    points.filter(isValidRouteMapPoint).forEach((point, index) => {
      const el = createMarkerElement(point, index, index * 150);

      const popup = new mb.Popup({
        offset: 20,
        className: "explore-route-popup",
        maxWidth: "min(300px, calc(100vw - 32px))",
        closeButton: false,
        closeOnClick: false,
      }).setHTML(createPopupHTML(point));

      const marker = new mb.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      const showPopup = () => {
        if (activeRoutePopup && activeRoutePopup !== popup)
          activeRoutePopup.remove();

        activeRoutePopup = popup;
        popup.setHTML(point.markerKind === "generated"
          ? createPlacePopupLoadingHTML({ name: point.name, day: point.day })
          : createPopupHTML(point));
        popup.setLngLat([point.lng, point.lat]).addTo(map);
        bindStoryPopupAction(point, popup, options);
        if (point.markerKind === "generated")
          void refreshPopupHTML(point, popup, options);
      };

      el.addEventListener("mouseenter", showPopup);
      el.addEventListener("click", showPopup);

      activeMarkers.push(marker);
    });
  }

  async function refreshPopupHTML(point: RouteMapPoint, popup: any, options: RoutePopupOptions) {
    if (!options.getPopupHTML)
      return;

    try {
      popup.setHTML(await options.getPopupHTML(point));
      bindStoryPopupAction(point, popup, options);
    }
    catch {
      popup.setHTML(createPopupHTML(point));
      bindStoryPopupAction(point, popup, options);
    }
  }

  function bindStoryPopupAction(point: RouteMapPoint, popup: any, options: RoutePopupOptions) {
    if (!options.onStoryRequest)
      return;

    const button = popup.getElement?.().querySelector?.("[data-place-story-cta]");
    if (!(button instanceof HTMLButtonElement))
      return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onStoryRequest?.(point);
    }, { once: true });
  }

  function renderRoute(points: RouteMapPoint[], legs: RouteLeg[]) {
    routeGeometryRequestId += 1;
    const requestId = routeGeometryRequestId;
    drawRouteLine(points);
    void drawRoadRouteLine(points, requestId);
    drawRouteLegLabels(legs);
    syncRouteDetailVisibility();
  }

  function drawRouteLine(points: RouteMapPoint[]) {
    const map = mapInstance.value;
    if (!map)
      return;

    removeLegacyRouteLayer();
    const routeCoordinates = points
      .filter(isValidRouteMapPoint)
      .map(point => [point.lng, point.lat]);

    if (routeCoordinates.length < 2) {
      removeLayerAndSource(ROUTE_LINE_LAYER_ID, ROUTE_LINE_SOURCE_ID);
      return;
    }

    const data = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
    };
    setRouteLineData(data);

    if (map.getLayer(ROUTE_LINE_LAYER_ID))
      return;

    map.addLayer({
      id: ROUTE_LINE_LAYER_ID,
      type: "line",
      source: ROUTE_LINE_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f59e0b",
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          0.55,
          ROUTE_DETAIL_ZOOM,
          0.95,
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          3,
          12,
          5,
        ],
        "line-dasharray": [2, 1.2],
      },
    });
  }

  async function drawRoadRouteLine(points: RouteMapPoint[], requestId: number) {
    const map = mapInstance.value;
    const routeCoordinates = points.filter(isValidRouteMapPoint);
    if (!map || !mapboxAccessToken || routeCoordinates.length < 2)
      return;

    const roadCoordinates = await fetchMapboxRoadRouteCoordinates(routeCoordinates);
    if (!roadCoordinates.length || requestId !== routeGeometryRequestId || map !== mapInstance.value)
      return;

    setRouteLineData({
      type: "Feature",
      properties: { geometrySource: "mapbox-directions" },
      geometry: {
        type: "LineString",
        coordinates: roadCoordinates,
      },
    });
  }

  function setRouteLineData(data: Record<string, any>) {
    const map = mapInstance.value;
    if (!map)
      return;

    const source = map.getSource(ROUTE_LINE_SOURCE_ID);
    if (source) {
      source.setData(data);
    }
    else {
      map.addSource(ROUTE_LINE_SOURCE_ID, {
        type: "geojson",
        data,
      });
    }
  }

  function drawRouteLegLabels(legs: RouteLeg[]) {
    const map = mapInstance.value;
    if (!map)
      return;

    const data: GeoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: legs
        .filter(leg => Boolean(leg.distanceLabel))
        .map(leg => ({
          type: "Feature",
          properties: {
            id: leg.id,
            label: leg.distanceLabel,
          },
          geometry: {
            type: "Point",
            coordinates: [leg.midpoint.lng, leg.midpoint.lat],
          },
        })),
    };

    const source = map.getSource(ROUTE_LEG_LABEL_SOURCE_ID);
    if (source) {
      source.setData(data);
    }
    else {
      map.addSource(ROUTE_LEG_LABEL_SOURCE_ID, {
        type: "geojson",
        data,
      });
    }

    if (map.getLayer(ROUTE_LEG_LABEL_LAYER_ID))
      return;

    map.addLayer({
      id: ROUTE_LEG_LABEL_LAYER_ID,
      type: "symbol",
      source: ROUTE_LEG_LABEL_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 12,
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "visibility": map.getZoom() >= ROUTE_DETAIL_ZOOM ? "visible" : "none",
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });
  }

  function clearRoute() {
    routeGeometryRequestId += 1;
    removeLayerAndSource(ROUTE_LEG_LABEL_LAYER_ID, ROUTE_LEG_LABEL_SOURCE_ID);
    removeLayerAndSource(ROUTE_LINE_LAYER_ID, ROUTE_LINE_SOURCE_ID);
    removeLegacyRouteLayer();
  }

  function removeLegacyRouteLayer() {
    removeLayerAndSource("route", "route");
  }

  function removeLayerAndSource(layerId: string, sourceId: string) {
    const map = mapInstance.value;
    if (!map)
      return;

    if (map.getLayer(layerId))
      map.removeLayer(layerId);
    if (map.getSource(sourceId))
      map.removeSource(sourceId);
  }

  function syncRouteDetailVisibility() {
    const map = mapInstance.value;
    if (!map || !map.getLayer(ROUTE_LEG_LABEL_LAYER_ID))
      return;

    map.setLayoutProperty(
      ROUTE_LEG_LABEL_LAYER_ID,
      "visibility",
      map.getZoom() >= ROUTE_DETAIL_ZOOM ? "visible" : "none",
    );
  }

  async function fitToRoute(points: RouteMapPoint[]) {
    const map = mapInstance.value;
    const mb = await getMapboxGL();
    if (!map || points.length === 0)
      return;

    const routePoints = points.filter(isValidRouteMapPoint);
    if (!routePoints.length)
      return;

    spinning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (routePoints.length === 1) {
      map.flyTo({
        center: [routePoints[0].lng, routePoints[0].lat],
        zoom: Math.max(map.getZoom(), 11),
        duration: 900,
      });
      return;
    }

    const bounds = new mb.LngLatBounds();
    routePoints.forEach(point => bounds.extend([point.lng, point.lat]));

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 80, left: 420, right: 80 },
      duration: 1500,
    });
  }

  function destroy() {
    if (animationFrameId)
      cancelAnimationFrame(animationFrameId);
    if (spinTimeoutId)
      clearTimeout(spinTimeoutId);
    routeGeometryRequestId += 1;
    clearMarkers();
    clearRoute();
    mapInstance.value?.remove();
    mapInstance.value = null;
    mapLoaded.value = false;
    spinning = true;
  }

  return {
    mapInstance,
    mapLoaded,
    initMap,
    clearMarkers,
    clearRoute,
    addMarkers,
    drawRouteLine,
    renderRoute,
    fitToRoute,
    destroy,
  };
}
