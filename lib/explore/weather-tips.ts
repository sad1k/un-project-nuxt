import { z } from "zod";

export const WeatherTipSourceSchema = z.object({
  label: z.string().min(1).max(120),
  confidence: z.enum(["low", "medium", "high"]),
});

export const WeatherForecastDaySchema = z.object({
  day: z.number().int().min(1).max(14),
  date: z.string().min(1).max(40).optional(),
  precipitationProbabilityMax: z.number().min(0).max(100).nullable().optional(),
  precipitationSum: z.number().min(0).nullable().optional(),
  apparentTemperatureMax: z.number().nullable().optional(),
  apparentTemperatureMin: z.number().nullable().optional(),
  windSpeedMax: z.number().min(0).nullable().optional(),
  weatherCode: z.number().int().nullable().optional(),
});

export const RouteWeatherTipSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["info", "caution", "high"]),
  day: z.number().int().min(1).max(14).optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(240),
  whatToTake: z.array(z.string().min(1).max(80)).max(5),
  source: WeatherTipSourceSchema,
  unavailable: z.boolean().optional(),
});

export const RouteWeatherTipsSchema = z.object({
  status: z.enum(["available", "unavailable"]),
  summary: z.string().min(1).max(240),
  tips: z.array(RouteWeatherTipSchema).max(12),
  source: WeatherTipSourceSchema,
});

export type WeatherForecastDay = z.infer<typeof WeatherForecastDaySchema>;
export type RouteWeatherTip = z.infer<typeof RouteWeatherTipSchema>;
export type RouteWeatherTips = z.infer<typeof RouteWeatherTipsSchema>;

const OPEN_METEO_SOURCE = {
  label: "Open-Meteo forecast",
  confidence: "medium" as const,
};

export function buildRouteWeatherTips(input: {
  forecastDays: WeatherForecastDay[];
  selectedDays: number;
  cityLabel?: string;
}): RouteWeatherTips {
  if (!input.forecastDays.length)
    return createUnavailableRouteWeatherTips("Weather forecast is unavailable for this route.");

  const tips = input.forecastDays.flatMap(day => buildTipsForForecastDay(day));
  if (input.selectedDays > 1) {
    tips.unshift({
      id: "multi-day-route",
      severity: "info",
      title: "Multi-day route weather",
      body: `Check each day before heading out; conditions can change across a ${input.selectedDays}-day itinerary.`,
      whatToTake: ["Flexible layer", "Refillable water bottle"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (!tips.length) {
    tips.push({
      id: "mild-weather",
      severity: "info",
      title: "Weather looks manageable",
      body: "No strong rain, heat, cold, or wind signal is available for the selected route window.",
      whatToTake: ["Comfortable shoes", "Water"],
      source: OPEN_METEO_SOURCE,
    });
  }

  return RouteWeatherTipsSchema.parse({
    status: "available",
    summary: input.cityLabel
      ? `Weather-aware tips for ${input.cityLabel}.`
      : "Weather-aware tips for this route.",
    tips: tips.slice(0, 12),
    source: OPEN_METEO_SOURCE,
  });
}

export function createUnavailableRouteWeatherTips(reason = "Weather data is unavailable right now."): RouteWeatherTips {
  return RouteWeatherTipsSchema.parse({
    status: "unavailable",
    summary: reason,
    tips: [{
      id: "weather-unavailable",
      severity: "info",
      title: "Weather unavailable",
      body: "Forecast data is missing, so avoid assuming conditions from the route alone.",
      whatToTake: ["Check local forecast", "Pack a light layer"],
      unavailable: true,
      source: {
        label: "Weather unavailable",
        confidence: "low",
      },
    }],
    source: {
      label: "Weather unavailable",
      confidence: "low",
    },
  });
}

function buildTipsForForecastDay(day: WeatherForecastDay): RouteWeatherTip[] {
  const tips: RouteWeatherTip[] = [];
  const dayLabel = `Day ${day.day}`;

  if (isRainy(day)) {
    tips.push({
      id: `rain-${day.day}`,
      day: day.day,
      severity: getSevereWeatherCode(day.weatherCode) ? "high" : "caution",
      title: `${dayLabel}: rain preparation`,
      body: "Rain is possible along the route; expect slower walking and less comfortable outdoor stops.",
      whatToTake: ["umbrella", "rain layer", "Water-resistant shoes"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.apparentTemperatureMax === "number" && day.apparentTemperatureMax >= 30) {
    tips.push({
      id: `heat-${day.day}`,
      day: day.day,
      severity: day.apparentTemperatureMax >= 35 ? "high" : "caution",
      title: `${dayLabel}: heat and sun`,
      body: "High apparent temperature can make long walks feel harder, especially between exposed stops.",
      whatToTake: ["water", "sun protection", "Breathable layer"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.apparentTemperatureMin === "number" && day.apparentTemperatureMin <= 5) {
    tips.push({
      id: `cold-${day.day}`,
      day: day.day,
      severity: day.apparentTemperatureMin <= -5 ? "high" : "caution",
      title: `${dayLabel}: cold comfort`,
      body: "Low apparent temperature may make waiting outdoors uncomfortable.",
      whatToTake: ["warm layer", "Gloves or hat"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.windSpeedMax === "number" && day.windSpeedMax >= 35) {
    tips.push({
      id: `wind-${day.day}`,
      day: day.day,
      severity: day.windSpeedMax >= 55 ? "high" : "caution",
      title: `${dayLabel}: wind caution`,
      body: "Strong wind can make bridges, waterfronts, and exposed viewpoints less comfortable.",
      whatToTake: ["Wind layer", "Secure hat or loose items"],
      source: OPEN_METEO_SOURCE,
    });
  }

  const severeCode = getSevereWeatherCode(day.weatherCode);
  if (severeCode && !tips.some(tip => tip.id === `rain-${day.day}`)) {
    tips.push({
      id: `severe-${day.day}`,
      day: day.day,
      severity: "high",
      title: `${dayLabel}: severe weather risk`,
      body: severeCode,
      whatToTake: ["Indoor backup", "Local forecast check"],
      source: OPEN_METEO_SOURCE,
    });
  }

  return tips;
}

function isRainy(day: WeatherForecastDay) {
  return (day.precipitationProbabilityMax ?? 0) >= 50
    || (day.precipitationSum ?? 0) >= 2
    || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(day.weatherCode ?? -1);
}

function getSevereWeatherCode(weatherCode: number | null | undefined) {
  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99)
    return "Thunderstorm conditions may affect outdoor stops.";

  if (weatherCode === 82)
    return "Heavy rain showers may affect outdoor stops.";

  if (weatherCode === 75 || weatherCode === 77 || weatherCode === 86)
    return "Snow or ice may affect walking comfort.";

  return "";
}
