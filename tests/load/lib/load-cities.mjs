/**
 * Geographically diverse city pool for load-test place creation.
 *
 * The list spans all populated continents and both hemispheres so synthetic
 * posts exercise the same lat/long range a real, global user base would
 * produce. Each entry carries a jitterDegrees radius (~0.05 ≈ 5km) used to
 * scatter individual photos around the city center rather than stacking them
 * on the exact same coordinates.
 */
export const LOAD_CITIES = Object.freeze([
  // North America
  { country: "USA", jitterDegrees: 0.08, lat: 40.7128, long: -74.0060, name: "New York" },
  { country: "USA", jitterDegrees: 0.10, lat: 34.0522, long: -118.2437, name: "Los Angeles" },
  { country: "USA", jitterDegrees: 0.06, lat: 41.8781, long: -87.6298, name: "Chicago" },
  { country: "USA", jitterDegrees: 0.05, lat: 47.6062, long: -122.3321, name: "Seattle" },
  { country: "Canada", jitterDegrees: 0.06, lat: 43.6532, long: -79.3832, name: "Toronto" },
  { country: "Canada", jitterDegrees: 0.05, lat: 49.2827, long: -123.1207, name: "Vancouver" },
  { country: "Mexico", jitterDegrees: 0.08, lat: 19.4326, long: -99.1332, name: "Mexico City" },
  { country: "USA", jitterDegrees: 0.05, lat: 21.3069, long: -157.8583, name: "Honolulu" },
  { country: "USA", jitterDegrees: 0.05, lat: 61.2181, long: -149.9003, name: "Anchorage" },

  // South America
  { country: "Brazil", jitterDegrees: 0.08, lat: -22.9068, long: -43.1729, name: "Rio de Janeiro" },
  { country: "Brazil", jitterDegrees: 0.08, lat: -23.5505, long: -46.6333, name: "São Paulo" },
  { country: "Argentina", jitterDegrees: 0.06, lat: -34.6037, long: -58.3816, name: "Buenos Aires" },
  { country: "Chile", jitterDegrees: 0.05, lat: -33.4489, long: -70.6693, name: "Santiago" },
  { country: "Peru", jitterDegrees: 0.06, lat: -12.0464, long: -77.0428, name: "Lima" },
  { country: "Colombia", jitterDegrees: 0.05, lat: 4.7110, long: -74.0721, name: "Bogotá" },

  // Europe
  { country: "UK", jitterDegrees: 0.06, lat: 51.5074, long: -0.1278, name: "London" },
  { country: "France", jitterDegrees: 0.05, lat: 48.8566, long: 2.3522, name: "Paris" },
  { country: "Germany", jitterDegrees: 0.06, lat: 52.5200, long: 13.4050, name: "Berlin" },
  { country: "Spain", jitterDegrees: 0.05, lat: 40.4168, long: -3.7038, name: "Madrid" },
  { country: "Italy", jitterDegrees: 0.05, lat: 41.9028, long: 12.4964, name: "Rome" },
  { country: "Netherlands", jitterDegrees: 0.04, lat: 52.3676, long: 4.9041, name: "Amsterdam" },
  { country: "Sweden", jitterDegrees: 0.05, lat: 59.3293, long: 18.0686, name: "Stockholm" },
  { country: "Greece", jitterDegrees: 0.05, lat: 37.9838, long: 23.7275, name: "Athens" },
  { country: "Türkiye", jitterDegrees: 0.08, lat: 41.0082, long: 28.9784, name: "Istanbul" },
  { country: "Russia", jitterDegrees: 0.08, lat: 55.7558, long: 37.6173, name: "Moscow" },
  { country: "Russia", jitterDegrees: 0.06, lat: 59.9311, long: 30.3609, name: "Saint Petersburg" },
  { country: "Iceland", jitterDegrees: 0.04, lat: 64.1466, long: -21.9426, name: "Reykjavik" },
  { country: "Portugal", jitterDegrees: 0.05, lat: 38.7223, long: -9.1393, name: "Lisbon" },

  // Africa
  { country: "Egypt", jitterDegrees: 0.06, lat: 30.0444, long: 31.2357, name: "Cairo" },
  { country: "Nigeria", jitterDegrees: 0.08, lat: 6.5244, long: 3.3792, name: "Lagos" },
  { country: "Kenya", jitterDegrees: 0.06, lat: -1.2921, long: 36.8219, name: "Nairobi" },
  { country: "South Africa", jitterDegrees: 0.06, lat: -33.9249, long: 18.4241, name: "Cape Town" },
  { country: "Morocco", jitterDegrees: 0.05, lat: 31.6295, long: -7.9811, name: "Marrakech" },
  { country: "Ethiopia", jitterDegrees: 0.06, lat: 9.1450, long: 40.4897, name: "Addis Ababa" },

  // Asia
  { country: "Japan", jitterDegrees: 0.08, lat: 35.6762, long: 139.6503, name: "Tokyo" },
  { country: "South Korea", jitterDegrees: 0.06, lat: 37.5665, long: 126.9780, name: "Seoul" },
  { country: "China", jitterDegrees: 0.08, lat: 39.9042, long: 116.4074, name: "Beijing" },
  { country: "China", jitterDegrees: 0.08, lat: 31.2304, long: 121.4737, name: "Shanghai" },
  { country: "Hong Kong", jitterDegrees: 0.04, lat: 22.3193, long: 114.1694, name: "Hong Kong" },
  { country: "India", jitterDegrees: 0.08, lat: 19.0760, long: 72.8777, name: "Mumbai" },
  { country: "India", jitterDegrees: 0.08, lat: 28.6139, long: 77.2090, name: "Delhi" },
  { country: "Thailand", jitterDegrees: 0.06, lat: 13.7563, long: 100.5018, name: "Bangkok" },
  { country: "Singapore", jitterDegrees: 0.04, lat: 1.3521, long: 103.8198, name: "Singapore" },
  { country: "UAE", jitterDegrees: 0.06, lat: 25.2048, long: 55.2708, name: "Dubai" },
  { country: "Iran", jitterDegrees: 0.06, lat: 35.6892, long: 51.3890, name: "Tehran" },
  { country: "Indonesia", jitterDegrees: 0.08, lat: -6.2088, long: 106.8456, name: "Jakarta" },
  { country: "Vietnam", jitterDegrees: 0.05, lat: 21.0285, long: 105.8542, name: "Hanoi" },
  { country: "Philippines", jitterDegrees: 0.05, lat: 14.5995, long: 120.9842, name: "Manila" },

  // Oceania
  { country: "Australia", jitterDegrees: 0.06, lat: -33.8688, long: 151.2093, name: "Sydney" },
  { country: "Australia", jitterDegrees: 0.06, lat: -37.8136, long: 144.9631, name: "Melbourne" },
  { country: "New Zealand", jitterDegrees: 0.05, lat: -36.8485, long: 174.7633, name: "Auckland" },
]);

/**
 * Deterministic [-1, 1] PRNG-like value derived from a seed. Stays stable
 * across runs so an investigation can replay the same coordinate sequence,
 * but spreads well across the input space because it discards the integer
 * component of sin(seed) * 10000.
 */
function deterministicNoise(seed) {
  const value = Math.sin(seed) * 10000;
  return (value - Math.floor(value)) * 2 - 1;
}

export function pickCity(workerIndex, sequence) {
  const index = (workerIndex * 7 + sequence * 11) % LOAD_CITIES.length;
  return LOAD_CITIES[index];
}

export function pickCityCoordinates(workerIndex, sequence) {
  const city = pickCity(workerIndex, sequence);
  const latSeed = workerIndex * 1000.13 + sequence * 1.17;
  const longSeed = workerIndex * 1000.71 + sequence * 1.93 + 0.5;
  return {
    city,
    lat: city.lat + deterministicNoise(latSeed) * city.jitterDegrees,
    long: city.long + deterministicNoise(longSeed) * city.jitterDegrees,
    placeName: `${city.name} ${workerIndex}-${sequence}`,
  };
}
