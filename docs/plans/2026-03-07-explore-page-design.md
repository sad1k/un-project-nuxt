# Explore Page Design

Route: `/explore`
Full-screen Mapbox GL JS travel route planner with mock AI generation.

## File Structure

```
pages/explore.vue                        — page shell, composes all overlays
components/explore/
  MapView.client.vue                     — Mapbox GL JS map (client-only)
  RoutePanel.vue                         — left sidebar (collapsible)
  HeaderOverlay.vue                      — top nav bar
  QuickActions.vue                       — right icon buttons
  RouteMarker.ts                         — marker creation helpers
composables/
  useMapbox.ts                           — map instance, markers, route line, camera
  useRouteGenerator.ts                   — mock data (Tokyo/Paris/fallback), filtering
```

- `MapView.client.vue` uses `.client` suffix for client-only rendering
- Mapbox token via `runtimeConfig.public.mapboxToken`
- `definePageMeta({ layout: false })` — no default layout, full-screen
- All overlays positioned absolute over the map with z-index layering

## Map Features

- Style: `mapbox://styles/mapbox/light-v11`
- Projection: `globe`
- Initial camera: center [30, 15], zoom 1.5, pitch 45, bearing -17.6
- scrollZoom and dragRotate enabled

### Auto-spinning globe
- On `idle` event, if zoom < 4, rotate by incrementing center.lng via requestAnimationFrame
- Pause on user interaction (mousedown, touchstart, wheel)
- Resume after 3s inactivity timeout

### Atmospheric fog
```js
map.setFog({
  color: 'rgb(255, 228, 196)',
  'high-color': 'rgb(245, 158, 11)',
  'horizon-blend': 0.08,
  'space-color': 'rgb(17, 24, 39)',
  'star-intensity': 0.15
})
```

### Other
- NavigationControl in bottom-right
- Gradient overlays: top (from-black/30, h-32) and bottom (from-black/20, h-24), pointer-events-none
- Loading screen: v-if="!mapLoaded", spinning globe emoji + "Loading map..." text, dismissed on map `load` event

## Route Generation (Mock)

Composable: `useRouteGenerator.ts`

### Mock datasets
- **Tokyo** (9 points, 3 days): temples, markets, parks, nightlife
- **Paris** (8 points, 3 days): landmarks, cafes, museums
- **Fallback** (5 points): generic City Center, Local Market, Park, Museum, Viewpoint

### Point shape
`{ id, day, name, type, lat, lng, emoji }`

### Matching
- `input.toLowerCase().includes('tokyo')` -> Tokyo
- `input.toLowerCase().includes('paris')` -> Paris
- Otherwise -> fallback

### Day filtering
- Duration selector offers 3, 5, 7, 10, 14 days
- Mock data caps at 3 days: `points.filter(p => p.day <= Math.min(selectedDays, 3))`

### Loading simulation
- 2-second setTimeout with `generating` flag

### Returned state
`{ destination, selectedDays, selectedInterests, points, generating, stats, generate() }`

Stats (computed): estimatedHours, placeCount, matchPercentage — derived from filtered points

## Markers & Popups

### Custom numbered markers
- Created via `mapboxgl.Marker({ element })` with custom DOM
- 32x32 circle, gradient from-coral-400 to-amber-500, white number inside
- CSS @keyframes drop animation (translateY -40px to 0 with bounce)
- Staggered: animation-delay = index * 150ms

### Hover popups
- mapboxgl.Popup with offset 25, no close button
- Show on mouseenter, remove on mouseleave
- Content: day badge, place name, type with color-coded dot
- Type colors: Culture=blue, Food=amber, Nature=green, Adventure=red, Art=purple, Nightlife=pink

### Marker clearing
- Track active markers array in useMapbox.ts
- Before new route: markers.forEach(m => m.remove()), clear array

## Route Line

- GeoJSON LineString source with all points in order
- Layer: line type, line-dasharray [2,2], line-color #f59e0b (amber-500), line-width 3
- Animated dash: requestAnimationFrame loop incrementing line-dashoffset
- Source/layer cleared and re-added on each new route

### Auto fit bounds
- fitBounds with padding: { top: 100, bottom: 80, left: 420, right: 80 }, duration 1500
- Left padding 420px accounts for open route panel

## Route Panel (Left Sidebar)

`RoutePanel.vue` — collapsible glassmorphic panel

### Container
- 380px expanded, 14px collapsed (thin strip with chevron)
- Position: absolute left-4 top-20 bottom-4
- Glass: bg-white/80 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl
- transition-all duration-300

### Contents (top to bottom)
1. **Header:** "Route Generator" + subtitle + collapse arrow
2. **Destination input:** text input with map-pin icon, placeholder "Tokyo, Japan"
3. **Duration selector:** 5 pill buttons (3, 5, 7, 10, 14 days), active has amber gradient + glow
4. **Interest tags:** 6 toggleable chips with emojis (Culture, Food, Nature, Adventure, Art, Nightlife)
5. **Quick stats:** 3-column grid (estimated time, places, match %) — shown after generation
6. **Generate button:** full-width amber gradient, "Generate Route" / "Regenerate", spinner on loading

## Header Overlay

`HeaderOverlay.vue` — top nav bar

- Position: absolute top-0 inset-x-0 z-30, h-64px, bg-transparent
- Left: orange gradient compass icon + "Wanderlust" in font-headline
- Center: "Explore" (active, amber underline), "My Trips", "Saved" — visual only
- Right: search icon + user avatar placeholder — visual only

## Quick Actions (Right Sidebar)

`QuickActions.vue` — vertical stack

- Position: absolute right-4 top-1/2 -translate-y-1/2 z-20
- 4 buttons (44x44): history, bookmark, share, settings
- Glass: bg-white/80 backdrop-blur-md rounded-xl shadow-lg border-white/20
- Hover: bg-white scale-105 shadow-xl
- All visual only

## Z-index Layering

1. Map (base)
2. Gradient overlays (z-10)
3. Quick actions (z-20)
4. Route panel (z-20)
5. Header overlay (z-30)
6. Loading screen (z-50)

## Not Implemented (Out of Scope)

- Real AI generation
- Itinerary detail panel
- Click-to-navigate markers
- Mobile responsiveness
- Dark mode for this page
- User auth integration
- Data persistence
