import type { ExploreNearbyPlace } from "~/lib/explore/nearby";
import type { RouteLeg, RouteMapPoint } from "~/lib/explore/route-map";

import { createNearbyMarkerElement, createNearbyPopupHTML } from "~/components/explore/nearby-marker";
import { createPlacePopupLoadingHTML } from "~/components/explore/place-popup";
import { createMarkerElement, createPopupHTML, updateMarkerLabel } from "~/components/explore/route-marker";
import { fetchMapboxRoadRouteCoordinates } from "~/lib/explore/road-route";
import { localizeMapLabels } from "~/lib/map/localize-labels";

const ROUTE_LINE_LAYER_ID = "explore-route-line";
const ROUTE_LINE_SOURCE_ID = "explore-route-line";
const ROUTE_LEG_LABEL_LAYER_ID = "explore-route-leg-labels";
const ROUTE_LEG_LABEL_SOURCE_ID = "explore-route-leg-labels";
const ROUTE_DETAIL_ZOOM = 10;
const DEFAULT_MAP_CENTER: [number, number] = [30, 15];
const DEFAULT_MAP_ZOOM = 1.5;
const MAP_THEME_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/outdoors-v12",
} as const;
const SATELLITE_MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

// Module-level shared state so all components share the same instance.
const mapInstance = shallowRef<any>(null);
const mapLoaded = ref(false);

type MarkerEntry = {
  marker: any;
  element: HTMLDivElement;
  labelElement: HTMLDivElement;
  popup: any | null;
  detachListeners: () => void;
  point: RouteMapPoint;
  detachDrag: () => void;
};
const activeMarkerMap = new Map<string, MarkerEntry>();
let activeRoutePopup: any = null;
let activeRoutePopupCloseTimeout: ReturnType<typeof setTimeout> | null = null;
const popupHoverCloseElements = new WeakSet<HTMLElement>();
let mapboxModule: any = null;
let mapboxAccessToken = "";
let animationFrameId: number | null = null;
let spinTimeoutId: ReturnType<typeof setTimeout> | null = null;
let spinning = true;
let hasActiveRoute = false;
let routeGeometryRequestId = 0;
let activeTheme: keyof typeof MAP_THEME_STYLES = "dark";
let activeStyleMode: "theme" | "satellite" = "theme";
let pointPlacementHandler: ((event: any) => void) | null = null;
let markerDragHandler: ((routePointId: string, lngLat: { lng: number; lat: number }) => void) | null = null;

// "Nearby places" feature: a single draggable location marker plus a set of
// lightweight suggestion markers. They live outside the route marker map so the
// route line and route reconciliation never weave them in.
type NearbyMarkerEntry = {
  marker: any;
  element: HTMLDivElement;
  popup: any | null;
  detach: () => void;
};
const nearbyMarkerMap = new Map<string, NearbyMarkerEntry>();
let locationMarker: any = null;
let locationMarkerDragHandler: ((coords: { lat: number; lng: number }) => void) | null = null;

type NearbyMarkerOptions = {
  selectedId?: string | null;
  onSelect?: (place: ExploreNearbyPlace) => void;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, any>>;
};

type RoutePopupOptions = {
  // Progressive renderer: gets a `render(html)` sink it may call repeatedly as data streams in
  // (skeleton → details → photo). Preferred over getPopupHTML when set.
  renderPopup?: (point: RouteMapPoint, render: (html: string) => void) => Promise<void> | void;
  getPopupHTML?: (point: RouteMapPoint) => Promise<string> | string;
  onDirectionsRequest?: (point: RouteMapPoint, nextPoint: RouteMapPoint | null) => void;
  onSaveRequest?: (point: RouteMapPoint) => Promise<void> | void;
  onStoryRequest?: (point: RouteMapPoint) => void;
  onMarkerClick?: (point: RouteMapPoint) => void;
  onRemoveRequest?: (point: RouteMapPoint) => void;
};

function isTouchDevice() {
  if (typeof window === "undefined")
    return false;
  return window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
}

async function getMapboxGL() {
  if (!mapboxModule) {
    // Co-load CSS with JS so importers of this composable don't drag
    // mapbox-gl.css into their initial compile graph.
    await import("mapbox-gl/dist/mapbox-gl.css");
    mapboxModule = await import("mapbox-gl");
  }
  return mapboxModule.default || mapboxModule;
}

function isValidRouteMapPoint(point: RouteMapPoint) {
  return Number.isFinite(point.lng)
    && Number.isFinite(point.lat)
    && point.lng >= -180
    && point.lng <= 180
    && point.lat >= -90
    && point.lat <= 90;
}

function getActiveMapStyle() {
  return activeStyleMode === "satellite"
    ? SATELLITE_MAP_STYLE
    : MAP_THEME_STYLES[activeTheme];
}

function applyExploreFog(map: any) {
  const isDark = activeTheme === "dark" || activeStyleMode === "satellite";

  map.setFog({
    "color": isDark ? "rgb(5, 8, 15)" : "rgb(235, 241, 245)",
    "high-color": isDark ? "rgb(12, 24, 44)" : "rgb(186, 220, 232)",
    "horizon-blend": 0.08,
    "space-color": isDark ? "rgb(2, 6, 23)" : "rgb(224, 235, 242)",
    "star-intensity": isDark ? 0.22 : 0,
  });
}

function pauseGlobeSpin(resumeDelay = 3000) {
  spinning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spinTimeoutId)
    clearTimeout(spinTimeoutId);

  const map = mapInstance.value;
  if (!map)
    return;

  spinTimeoutId = setTimeout(() => {
    if (hasActiveRoute)
      return;
    spinning = true;
    if (map.getZoom() < 4)
      startGlobeSpin(map);
  }, resumeDelay);
}

function startGlobeSpin(map: any) {
  if (!spinning || hasActiveRoute)
    return;
  animationFrameId = requestAnimationFrame(() => {
    if (!map || !spinning)
      return;
    const center = map.getCenter();
    center.lng += 0.005;
    map.setCenter(center);
    startGlobeSpin(map);
  });
}

export function useMapbox() {
  async function initMap(container: HTMLElement, token: string) {
    if (mapInstance.value) {
      mapInstance.value.remove();
      mapInstance.value = null;
      mapLoaded.value = false;
    }

    const mb = await getMapboxGL();
    mapboxAccessToken = token;

    const map = new mb.Map({
      // Pass the token via constructor option rather than mutating
      // the shared `mb.accessToken` global.
      accessToken: token,
      container,
      style: getActiveMapStyle(),
      projection: "globe",
      pitch: 45,
      bearing: -17.6,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
    });

    map.addControl(new mb.NavigationControl(), "bottom-right");

    map.on("style.load", () => {
      applyExploreFog(map);
      localizeMapLabels(map);
      mapLoaded.value = true;
    });

    map.on("error", (e: any) => {
      console.error("[useMapbox] map error:", e.error?.message || e);
    });

    if (map.isStyleLoaded()) {
      mapLoaded.value = true;
    }

    map.on("idle", () => {
      if (hasActiveRoute)
        return;
      if (map.getZoom() < 4 && spinning) {
        startGlobeSpin(map);
      }
    });

    map.on("zoomend", syncRouteDetailVisibility);
    map.on("moveend", syncRouteDetailVisibility);

    const pauseSpin = () => {
      pauseGlobeSpin();
    };

    map.on("mousedown", pauseSpin);
    map.on("touchstart", pauseSpin);
    map.on("wheel", pauseSpin);

    mapInstance.value = map;
  }

  function clearMarkers() {
    cancelRoutePopupClose();
    activeRoutePopup?.remove();
    activeRoutePopup = null;
    for (const entry of activeMarkerMap.values()) {
      entry.detachListeners();
      entry.detachDrag();
      entry.popup?.remove();
      entry.marker.remove();
    }
    activeMarkerMap.clear();
    hasActiveRoute = false;
  }

  async function addMarkers(points: RouteMapPoint[], options: RoutePopupOptions = {}) {
    const map = mapInstance.value;
    const mb = await getMapboxGL();
    if (!map)
      return;

    const validPoints = points.filter(isValidRouteMapPoint);
    if (validPoints.length > 0)
      hasActiveRoute = true;

    const touch = isTouchDevice();
    const seenIds = new Set<string>();
    const hadMarkersBefore = activeMarkerMap.size > 0;

    validPoints.forEach((point, index) => {
      seenIds.add(point.id);
      const nextPoint = validPoints[index + 1] ?? null;
      const existing = activeMarkerMap.get(point.id);

      if (existing) {
        existing.marker.setLngLat([point.lng, point.lat]);
        updateMarkerLabel(existing.labelElement, point, index);
        existing.detachListeners();
        existing.detachListeners = bindMarkerInteractions(
          existing.element,
          existing.popup,
          point,
          nextPoint,
          options,
          touch,
          map,
        );
        existing.point = point;
        existing.detachDrag();
        existing.detachDrag = bindMarkerDrag(existing.marker, point);
        return;
      }

      const delayMs = hadMarkersBefore ? 0 : index * 150;
      const { element, labelElement } = createMarkerElement(point, index, delayMs);
      const marker = new mb.Marker({ element, draggable: Boolean(markerDragHandler) && point.markerKind === "generated" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      const popup = touch
        ? null
        : new mb.Popup({
            offset: 20,
            className: "explore-route-popup",
            maxWidth: "min(300px, calc(100vw - 32px))",
            closeButton: false,
            closeOnClick: false,
          }).setHTML(createPopupHTML(point));

      const detachListeners = bindMarkerInteractions(
        element,
        popup,
        point,
        nextPoint,
        options,
        touch,
        map,
      );

      activeMarkerMap.set(point.id, {
        marker,
        element,
        labelElement,
        popup,
        detachListeners,
        point,
        detachDrag: bindMarkerDrag(marker, point),
      });
    });

    for (const [id, entry] of activeMarkerMap) {
      if (seenIds.has(id))
        continue;

      entry.detachListeners();
      entry.detachDrag();
      if (activeRoutePopup === entry.popup) {
        activeRoutePopup.remove();
        activeRoutePopup = null;
      }
      entry.popup?.remove();
      entry.marker.remove();
      activeMarkerMap.delete(id);
    }
  }

  function bindMarkerDrag(marker: any, point: RouteMapPoint): () => void {
    const onDragEnd = () => {
      if (point.markerKind !== "generated")
        return;
      const lngLat = marker.getLngLat();
      markerDragHandler?.(point.sourceId, { lng: lngLat.lng, lat: lngLat.lat });
    };
    marker.on("dragend", onDragEnd);
    return () => marker.off("dragend", onDragEnd);
  }

  function bindMarkerInteractions(
    el: HTMLDivElement,
    popup: any | null,
    point: RouteMapPoint,
    nextPoint: RouteMapPoint | null,
    options: RoutePopupOptions,
    touch: boolean,
    map: any,
  ): () => void {
    const controller = new AbortController();
    const { signal } = controller;

    if (touch) {
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        options.onMarkerClick?.(point);
      }, { signal });
      return () => controller.abort();
    }

    if (!popup)
      return () => controller.abort();

    const showPopup = () => {
      cancelRoutePopupClose();
      if (activeRoutePopup && activeRoutePopup !== popup)
        activeRoutePopup.remove();

      activeRoutePopup = popup;
      popup.setHTML(point.markerKind === "generated"
        ? createPlacePopupLoadingHTML({ name: point.name, day: point.day })
        : createPopupHTML(point));
      popup.setLngLat([point.lng, point.lat]).addTo(map);
      bindPopupActions(point, nextPoint, popup, options);
      bindPopupHoverClose(popup);
      if (point.markerKind === "generated")
        void refreshPopupHTML(point, nextPoint, popup, options);
    };

    el.addEventListener("mouseenter", showPopup, { signal });
    el.addEventListener("mouseleave", () => scheduleRoutePopupClose(popup), { signal });
    // Desktop: hover shows the quick popup preview; a click opens the full detail panel (sidebar),
    // same as a tap on mobile. Without this the click only re-showed the popup and the sidebar
    // (driven by onMarkerClick → openPlaceSheet) never opened.
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onMarkerClick?.(point);
    }, { signal });

    return () => controller.abort();
  }

  async function refreshPopupHTML(
    point: RouteMapPoint,
    nextPoint: RouteMapPoint | null,
    popup: any,
    options: RoutePopupOptions,
  ) {
    // Repaint sink: ignore writes once this popup is no longer the active one, so a slow photo
    // request can't overwrite a popup the user already moved away from.
    const render = (html: string) => {
      if (activeRoutePopup !== popup)
        return;
      popup.setHTML(html);
      bindPopupActions(point, nextPoint, popup, options);
      bindPopupHoverClose(popup);
    };

    if (options.renderPopup) {
      try {
        await options.renderPopup(point, render);
      }
      catch {
        render(createPopupHTML(point));
      }
      return;
    }

    if (!options.getPopupHTML)
      return;

    try {
      render(await options.getPopupHTML(point));
    }
    catch {
      render(createPopupHTML(point));
    }
  }

  function bindPopupHoverClose(popup: any) {
    const popupElement = popup.getElement?.();
    if (!(popupElement instanceof HTMLElement))
      return;
    if (popupHoverCloseElements.has(popupElement))
      return;

    popupHoverCloseElements.add(popupElement);
    popupElement.addEventListener("mouseenter", cancelRoutePopupClose);
    popupElement.addEventListener("mouseleave", () => scheduleRoutePopupClose(popup));
  }

  function scheduleRoutePopupClose(popup: any) {
    cancelRoutePopupClose();
    activeRoutePopupCloseTimeout = setTimeout(() => {
      if (activeRoutePopup !== popup)
        return;

      popup.remove();
      activeRoutePopup = null;
      activeRoutePopupCloseTimeout = null;
    }, 1000);
  }

  function cancelRoutePopupClose() {
    if (!activeRoutePopupCloseTimeout)
      return;

    clearTimeout(activeRoutePopupCloseTimeout);
    activeRoutePopupCloseTimeout = null;
  }

  function bindPopupActions(
    point: RouteMapPoint,
    nextPoint: RouteMapPoint | null,
    popup: any,
    options: RoutePopupOptions,
  ) {
    bindPopupButton(popup, "[data-place-story-cta]", (button) => {
      if (!options.onStoryRequest)
        return;

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onStoryRequest?.(point);
      }, { once: true });
    });

    bindPopupButton(popup, "[data-place-save-cta]", (button) => {
      if (!options.onSaveRequest)
        return;

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        button.textContent = "Saving...";
        try {
          await options.onSaveRequest?.(point);
          button.textContent = "Saved";
        }
        catch {
          button.disabled = false;
          button.textContent = "Save";
        }
      }, { once: true });
    });

    bindPopupButton(popup, "[data-place-directions-cta]", (button) => {
      if (!options.onDirectionsRequest || !nextPoint) {
        button.disabled = true;
        button.textContent = "No next stop";
        return;
      }

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onDirectionsRequest?.(point, nextPoint);
      }, { once: true });
    });

    bindPopupButton(popup, "[data-place-remove-cta]", (button) => {
      if (!options.onRemoveRequest)
        return;

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onRemoveRequest?.(point);
      }, { once: true });
    });
  }

  function bindPopupButton(
    popup: any,
    selector: string,
    bind: (button: HTMLButtonElement) => void,
  ) {
    const button = popup.getElement?.().querySelector?.(selector);
    if (button instanceof HTMLButtonElement)
      bind(button);
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
        "line-color": "#2dd4bf",
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
        "line-blur": 1,
      },
    });
  }

  async function drawRoadRouteLine(points: RouteMapPoint[], requestId: number) {
    const map = mapInstance.value;
    const routeCoordinates = points.filter(isValidRouteMapPoint);
    if (!map || !mapboxAccessToken || routeCoordinates.length < 2)
      return;

    const roadCoordinates = await fetchMapboxRoadRouteCoordinates(routeCoordinates, mapboxAccessToken);
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
        "text-color": "#f3d19e",
        "text-halo-color": "#050505",
        "text-halo-width": 1.5,
      },
    });
  }

  function clearRoute() {
    routeGeometryRequestId += 1;
    removeLayerAndSource(ROUTE_LEG_LABEL_LAYER_ID, ROUTE_LEG_LABEL_SOURCE_ID);
    removeLayerAndSource(ROUTE_LINE_LAYER_ID, ROUTE_LINE_SOURCE_ID);
    removeLegacyRouteLayer();
  }

  function zoomIn() {
    const map = mapInstance.value;
    if (!map)
      return;

    pauseGlobeSpin();
    map.zoomIn({ duration: 350 });
  }

  function zoomOut() {
    const map = mapInstance.value;
    if (!map)
      return;

    pauseGlobeSpin();
    map.zoomOut({ duration: 350 });
  }

  async function centerMap(points: RouteMapPoint[] = []) {
    const map = mapInstance.value;
    if (!map)
      return;

    const validPoints = points.filter(isValidRouteMapPoint);
    if (validPoints.length) {
      await fitToRoute(validPoints);
      return;
    }

    pauseGlobeSpin(5000);
    map.flyTo({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      pitch: 45,
      bearing: -17.6,
      duration: 900,
    });
  }

  function flyToPoint(point: { lat: number; lng: number }, options?: { zoom?: number; duration?: number }) {
    const map = mapInstance.value;
    if (!map)
      return;

    spinning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    map.flyTo({
      center: [point.lng, point.lat],
      zoom: options?.zoom ?? Math.max(map.getZoom(), 14),
      duration: options?.duration ?? 600,
    });
  }

  function enablePointPlacement(onPlace: (coordinates: { lng: number; lat: number }) => void) {
    const map = mapInstance.value;
    if (!map)
      return;

    disablePointPlacement();
    // Keep the globe from spinning back in while the user is dropping stops.
    pauseGlobeSpin(600000);

    pointPlacementHandler = (event: any) => {
      const lngLat = event?.lngLat;
      if (!lngLat || typeof lngLat.lng !== "number" || typeof lngLat.lat !== "number")
        return;
      onPlace({ lng: lngLat.lng, lat: lngLat.lat });
    };

    map.on("click", pointPlacementHandler);
    const canvas = map.getCanvas?.();
    if (canvas)
      canvas.style.cursor = "crosshair";
  }

  function disablePointPlacement() {
    const map = mapInstance.value;
    if (pointPlacementHandler && map)
      map.off("click", pointPlacementHandler);
    pointPlacementHandler = null;

    const canvas = map?.getCanvas?.();
    if (canvas)
      canvas.style.cursor = "";
  }

  function enableMarkerDragging(onDragEnd: (routePointId: string, lngLat: { lng: number; lat: number }) => void) {
    markerDragHandler = onDragEnd;
    for (const entry of activeMarkerMap.values()) {
      if (entry.point.markerKind === "generated")
        entry.marker.setDraggable(true);
    }
  }

  function disableMarkerDragging() {
    markerDragHandler = null;
    for (const entry of activeMarkerMap.values())
      entry.marker.setDraggable(false);
  }

  function toggleMapStyle() {
    const map = mapInstance.value;
    if (!map)
      return;

    pauseGlobeSpin(5000);
    mapLoaded.value = false;
    activeStyleMode = activeStyleMode === "theme" ? "satellite" : "theme";
    map.setStyle(getActiveMapStyle());
  }

  function setMapTheme(theme: "dark" | "light") {
    const map = mapInstance.value;
    activeTheme = theme;

    if (!map)
      return;

    if (activeStyleMode === "satellite") {
      applyExploreFog(map);
      return;
    }

    mapLoaded.value = false;
    map.setStyle(getActiveMapStyle());
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
      padding: { top: 100, bottom: 96, left: 120, right: 440 },
      duration: 1500,
    });
  }

  async function setLocationMarker(
    coords: { lat: number; lng: number },
    options?: { onDragEnd?: (coords: { lat: number; lng: number }) => void },
  ) {
    const map = mapInstance.value;
    const mb = await getMapboxGL();
    if (!map)
      return;

    locationMarkerDragHandler = options?.onDragEnd ?? null;

    if (locationMarker) {
      locationMarker.setLngLat([coords.lng, coords.lat]);
      return;
    }

    // Reuse the existing "current-location" marker visual (a rounded "Вы" chip).
    const point: RouteMapPoint = {
      id: "current-location",
      sourceId: "current-location",
      markerKind: "current-location",
      sequence: 0,
      day: 1,
      name: "Вы здесь",
      lat: coords.lat,
      lng: coords.lng,
    };
    const { element } = createMarkerElement(point, 0, 0);
    const marker = new mb.Marker({ element, draggable: true })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    marker.on("dragstart", () => pauseGlobeSpin(600000));
    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      locationMarkerDragHandler?.({ lat: lngLat.lat, lng: lngLat.lng });
    });

    locationMarker = marker;
  }

  function removeLocationMarker() {
    locationMarker?.remove();
    locationMarker = null;
    locationMarkerDragHandler = null;
  }

  async function setNearbyMarkers(places: ExploreNearbyPlace[], options: NearbyMarkerOptions = {}) {
    const map = mapInstance.value;
    const mb = await getMapboxGL();
    if (!map)
      return;

    const touch = isTouchDevice();
    const seenIds = new Set<string>();

    places.forEach((place, index) => {
      seenIds.add(place.id);
      // Small list, infrequent changes: rebuild each marker so selection state
      // and ordering stay correct without bespoke reconciliation.
      nearbyMarkerMap.get(place.id)?.detach();
      nearbyMarkerMap.get(place.id)?.marker.remove();

      const element = createNearbyMarkerElement(place, index, options.selectedId === place.id);
      const marker = new mb.Marker({ element })
        .setLngLat([place.coordinates.long, place.coordinates.lat])
        .addTo(map);

      const popup = touch
        ? null
        : new mb.Popup({
            offset: 16,
            className: "explore-route-popup",
            maxWidth: "min(240px, calc(100vw - 32px))",
            closeButton: false,
            closeOnClick: false,
          }).setHTML(createNearbyPopupHTML(place));

      const controller = new AbortController();
      const { signal } = controller;

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        options.onSelect?.(place);
      }, { signal });

      if (popup) {
        element.addEventListener("mouseenter", () => {
          popup.setLngLat([place.coordinates.long, place.coordinates.lat]).addTo(map);
        }, { signal });
        element.addEventListener("mouseleave", () => popup.remove(), { signal });
      }

      nearbyMarkerMap.set(place.id, {
        marker,
        element,
        popup,
        detach: () => {
          controller.abort();
          popup?.remove();
        },
      });
    });

    for (const [id, entry] of nearbyMarkerMap) {
      if (seenIds.has(id))
        continue;

      entry.detach();
      entry.marker.remove();
      nearbyMarkerMap.delete(id);
    }
  }

  function clearNearbyMarkers() {
    for (const entry of nearbyMarkerMap.values()) {
      entry.detach();
      entry.marker.remove();
    }
    nearbyMarkerMap.clear();
  }

  function destroy() {
    if (animationFrameId)
      cancelAnimationFrame(animationFrameId);
    if (spinTimeoutId)
      clearTimeout(spinTimeoutId);
    routeGeometryRequestId += 1;
    disablePointPlacement();
    disableMarkerDragging();
    clearMarkers();
    clearRoute();
    clearNearbyMarkers();
    removeLocationMarker();
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
    zoomIn,
    zoomOut,
    centerMap,
    flyToPoint,
    enablePointPlacement,
    disablePointPlacement,
    enableMarkerDragging,
    disableMarkerDragging,
    setLocationMarker,
    removeLocationMarker,
    setNearbyMarkers,
    clearNearbyMarkers,
    toggleMapStyle,
    setMapTheme,
    destroy,
  };
}
