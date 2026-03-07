export type RoutePoint = {
  id: string
  day: number
  name: string
  type: 'culture' | 'food' | 'nature' | 'adventure' | 'art' | 'nightlife'
  lat: number
  lng: number
  emoji: string
}

export type RouteStats = {
  estimatedHours: number
  placeCount: number
  matchPercentage: number
}

const TOKYO_POINTS: RoutePoint[] = [
  { id: 'tk1', day: 1, name: 'Senso-ji Temple', type: 'culture', lat: 35.7148, lng: 139.7967, emoji: '🏛' },
  { id: 'tk2', day: 1, name: 'Tsukiji Outer Market', type: 'food', lat: 35.6654, lng: 139.7707, emoji: '🍜' },
  { id: 'tk3', day: 1, name: 'Meiji Shrine', type: 'culture', lat: 35.6764, lng: 139.6993, emoji: '🏛' },
  { id: 'tk4', day: 2, name: 'Shibuya Crossing', type: 'adventure', lat: 35.6595, lng: 139.7004, emoji: '⛰️' },
  { id: 'tk5', day: 2, name: 'Akihabara', type: 'art', lat: 35.7023, lng: 139.7745, emoji: '🎨' },
  { id: 'tk6', day: 2, name: 'Ueno Park', type: 'nature', lat: 35.7146, lng: 139.7732, emoji: '🌿' },
  { id: 'tk7', day: 3, name: 'Tokyo Tower', type: 'culture', lat: 35.6586, lng: 139.7454, emoji: '🏛' },
  { id: 'tk8', day: 3, name: 'Shinjuku Gyoen', type: 'nature', lat: 35.6852, lng: 139.7100, emoji: '🌿' },
  { id: 'tk9', day: 3, name: 'Golden Gai', type: 'nightlife', lat: 35.6938, lng: 139.7036, emoji: '🌙' },
]

const PARIS_POINTS: RoutePoint[] = [
  { id: 'pr1', day: 1, name: 'Eiffel Tower', type: 'culture', lat: 48.8584, lng: 2.2945, emoji: '🏛' },
  { id: 'pr2', day: 1, name: 'Louvre Museum', type: 'art', lat: 48.8606, lng: 2.3376, emoji: '🎨' },
  { id: 'pr3', day: 1, name: 'Champs-Elysees', type: 'adventure', lat: 48.8698, lng: 2.3075, emoji: '⛰️' },
  { id: 'pr4', day: 2, name: 'Montmartre', type: 'culture', lat: 48.8867, lng: 2.3431, emoji: '🏛' },
  { id: 'pr5', day: 2, name: 'Sacre-Coeur', type: 'culture', lat: 48.8867, lng: 2.3431, emoji: '🏛' },
  { id: 'pr6', day: 2, name: 'Cafe de Flore', type: 'food', lat: 48.8540, lng: 2.3325, emoji: '🍜' },
  { id: 'pr7', day: 3, name: 'Notre-Dame', type: 'culture', lat: 48.8530, lng: 2.3499, emoji: '🏛' },
  { id: 'pr8', day: 3, name: 'Jardin du Luxembourg', type: 'nature', lat: 48.8462, lng: 2.3372, emoji: '🌿' },
]

const FALLBACK_POINTS: RoutePoint[] = [
  { id: 'fb1', day: 1, name: 'City Center', type: 'culture', lat: 40.7128, lng: -74.0060, emoji: '🏛' },
  { id: 'fb2', day: 1, name: 'Local Market', type: 'food', lat: 40.7148, lng: -74.0020, emoji: '🍜' },
  { id: 'fb3', day: 1, name: 'Central Park', type: 'nature', lat: 40.7282, lng: -73.9942, emoji: '🌿' },
  { id: 'fb4', day: 2, name: 'National Museum', type: 'art', lat: 40.7794, lng: -73.9632, emoji: '🎨' },
  { id: 'fb5', day: 2, name: 'Sunset Viewpoint', type: 'adventure', lat: 40.7484, lng: -73.9857, emoji: '⛰️' },
]

export function useRouteGenerator() {
  const destination = ref('')
  const selectedDays = ref(3)
  const selectedInterests = ref(new Set<string>())
  const generating = ref(false)
  const points = ref<RoutePoint[]>([])

  function generate() {
    generating.value = true
    points.value = []

    setTimeout(() => {
      const dest = destination.value.toLowerCase().trim()
      let matched: RoutePoint[]

      if (dest.includes('tokyo')) {
        matched = TOKYO_POINTS
      }
      else if (dest.includes('paris')) {
        matched = PARIS_POINTS
      }
      else {
        matched = FALLBACK_POINTS
      }

      const maxDay = Math.min(selectedDays.value, 3)
      points.value = matched.filter(p => p.day <= maxDay)
      generating.value = false
    }, 2000)
  }

  const stats = computed<RouteStats>(() => ({
    estimatedHours: points.value.length * 2,
    placeCount: points.value.length,
    matchPercentage: points.value.length > 0 ? Math.min(95, 70 + points.value.length * 3) : 0,
  }))

  return {
    destination,
    selectedDays,
    selectedInterests,
    generating,
    points,
    generate,
    stats,
  }
}
