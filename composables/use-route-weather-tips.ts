import type { RouteMapPoint } from "~/lib/explore/route-map";
import type { RouteWeatherTips } from "~/lib/explore/weather-tips";

import { createUnavailableRouteWeatherTips } from "~/lib/explore/weather-tips";

export function useRouteWeatherTips() {
  const status = ref<"idle" | "loading" | "loaded" | "unavailable" | "error">("idle");
  const tips = ref<RouteWeatherTips | null>(null);
  const error = ref<string | null>(null);
  const cache = useState<Record<string, RouteWeatherTips>>("explore-route-weather-tips-cache", () => ({}));

  function cacheKey(input: {
    points: RouteMapPoint[];
    selectedDays: number;
    cityLabel?: string;
  }) {
    const pointsKey = input.points
      .map(point => `${point.day}:${point.lat.toFixed(3)}:${point.lng.toFixed(3)}`)
      .join("|");
    return `${input.cityLabel || "route"}:${input.selectedDays}:${pointsKey}`;
  }

  async function loadWeatherTips(input: {
    points: RouteMapPoint[];
    selectedDays: number;
    cityLabel?: string;
  }) {
    if (!input.points.length) {
      tips.value = createUnavailableRouteWeatherTips("Weather tips will appear after a route is generated.");
      status.value = "unavailable";
      return tips.value;
    }

    const key = cacheKey(input);
    if (cache.value[key]) {
      tips.value = cache.value[key];
      status.value = tips.value.status === "available" ? "loaded" : "unavailable";
      return tips.value;
    }

    status.value = "loading";
    error.value = null;

    try {
      const data = await $fetch<RouteWeatherTips>("/api/explore/weather-tips", {
        query: {
          points: JSON.stringify(input.points.map(point => ({
            lat: point.lat,
            long: point.lng,
            day: point.day,
          }))),
          selectedDays: input.selectedDays,
          cityLabel: input.cityLabel,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      cache.value = {
        ...cache.value,
        [key]: data,
      };
      tips.value = data;
      status.value = data.status === "available" ? "loaded" : "unavailable";
      return data;
    }
    catch (caughtError) {
      const data = createUnavailableRouteWeatherTips("Weather tips are unavailable right now.");
      error.value = caughtError instanceof Error ? caughtError.message : "weather_tips_unavailable";
      tips.value = data;
      status.value = "error";
      return data;
    }
  }

  return {
    status,
    tips,
    error,
    cacheKey,
    loadWeatherTips,
  };
}
