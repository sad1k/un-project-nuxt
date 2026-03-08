import mapboxgl from 'mapbox-gl'

import { createMarkerElement, createPopupHTML } from '~/components/explore/RouteMarker'

import type { RoutePoint } from './useRouteGenerator'

export function useMapbox() {
  const mapInstance = shallowRef<mapboxgl.Map | null>(null)
  const mapLoaded = ref(false)
  const activeMarkers: mapboxgl.Marker[] = []
  let animationFrameId: number | null = null
  let spinTimeoutId: ReturnType<typeof setTimeout> | null = null
  let spinning = true

  function initMap(container: HTMLElement, token: string) {
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/light-v11',
      projection: 'globe',
      pitch: 45,
      bearing: -17.6,
      center: [30, 15],
      zoom: 1.5,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    map.on('style.load', () => {
      map.setFog({
        color: 'rgb(255, 245, 235)',
        'high-color': 'rgb(255, 220, 180)',
        'horizon-blend': 0.08,
        'space-color': 'rgb(15, 15, 30)',
        'star-intensity': 0.6,
      })
    })

    map.on('load', () => {
      mapLoaded.value = true
    })

    function startSpin() {
      if (!spinning) return
      animationFrameId = requestAnimationFrame(() => {
        if (!map || !spinning) return
        const center = map.getCenter()
        center.lng += 0.005
        map.setCenter(center)
        startSpin()
      })
    }

    map.on('idle', () => {
      if (map.getZoom() < 4 && spinning) {
        startSpin()
      }
    })

    const pauseSpin = () => {
      spinning = false
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      if (spinTimeoutId) clearTimeout(spinTimeoutId)
      spinTimeoutId = setTimeout(() => {
        spinning = true
        if (map.getZoom() < 4) startSpin()
      }, 3000)
    }

    map.on('mousedown', pauseSpin)
    map.on('touchstart', pauseSpin)
    map.on('wheel', pauseSpin)

    mapInstance.value = map
  }

  function clearMarkers() {
    activeMarkers.forEach(m => m.remove())
    activeMarkers.length = 0
  }

  function addMarkers(points: RoutePoint[]) {
    clearMarkers()
    const map = mapInstance.value
    if (!map) return

    points.forEach((point, index) => {
      const el = createMarkerElement(index, index * 150)

      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(createPopupHTML(point))

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map)

      el.addEventListener('mouseenter', () => {
        popup.setLngLat([point.lng, point.lat]).addTo(map)
      })
      el.addEventListener('mouseleave', () => {
        popup.remove()
      })

      activeMarkers.push(marker)
    })
  }

  function drawRouteLine(points: RoutePoint[]) {
    const map = mapInstance.value
    if (!map) return

    if (map.getLayer('route')) map.removeLayer('route')
    if (map.getSource('route')) map.removeSource('route')

    const coordinates = points.map(p => [p.lng, p.lat])

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    })

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#f59e0b',
        'line-width': 3,
        'line-dasharray': [2, 2],
      },
    })
  }

  function fitToRoute(points: RoutePoint[]) {
    const map = mapInstance.value
    if (!map || points.length === 0) return

    spinning = false
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    const bounds = new mapboxgl.LngLatBounds()
    points.forEach(p => bounds.extend([p.lng, p.lat]))

    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 80, left: 420, right: 80 },
      duration: 1500,
    })
  }

  function destroy() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    if (spinTimeoutId) clearTimeout(spinTimeoutId)
    clearMarkers()
    mapInstance.value?.remove()
    mapInstance.value = null
  }

  return {
    mapInstance,
    mapLoaded,
    initMap,
    clearMarkers,
    addMarkers,
    drawRouteLine,
    fitToRoute,
    destroy,
  }
}
