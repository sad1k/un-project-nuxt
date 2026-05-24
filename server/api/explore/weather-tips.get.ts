import { z } from "zod";

import { buildRouteWeatherTips, createUnavailableRouteWeatherTips } from "~/lib/explore/weather-tips";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

const RoutePointQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
  day: z.number().int().min(1).max(14),
}).array().min(1).max(60);

const QuerySchema = z.object({
  points: z.string().trim().min(2).max(8000),
  selectedDays: z.coerce.number().int().min(1).max(14).default(1),
  cityLabel: z.string().trim().max(160).optional(),
  timezone: z.string().trim().max(80).optional(),
});

export default defineAuthenticatedHandler(async (event) => {
  const query = await getValidatedQuery(event, QuerySchema.parse);
  const points = parsePoints(query.points);
  if (!points.length)
    return createUnavailableRouteWeatherTips("Для погодных советов нужна хотя бы одна координата маршрута.");

  try {
    const forecast = await fetchOpenMeteoForecast({
      lat: average(points.map(point => point.lat)),
      long: average(points.map(point => point.long)),
      forecastDays: query.selectedDays,
      timezone: query.timezone,
    });

    return buildRouteWeatherTips({
      forecastDays: forecast,
      selectedDays: query.selectedDays,
      cityLabel: query.cityLabel,
    });
  }
  catch {
    return createUnavailableRouteWeatherTips("Прогноз погоды недоступен для этого маршрута.");
  }
});

async function fetchOpenMeteoForecast(input: {
  lat: number;
  long: number;
  forecastDays: number;
  timezone?: string;
}) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", input.lat.toFixed(5));
  url.searchParams.set("longitude", input.long.toFixed(5));
  url.searchParams.set("forecast_days", String(input.forecastDays));
  url.searchParams.set("timezone", input.timezone || "auto");
  url.searchParams.set("daily", [
    "weather_code",
    "precipitation_probability_max",
    "precipitation_sum",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "wind_speed_10m_max",
  ].join(","));

  const response = await fetch(url);
  if (!response.ok)
    throw new Error("open_meteo_unavailable");

  const payload = await response.json();
  const daily = isRecord(payload) && isRecord(payload.daily) ? payload.daily : null;
  if (!daily)
    return [];

  return normalizeDailyForecast(daily);
}

function normalizeDailyForecast(daily: Record<string, unknown>) {
  const dates = toArray(daily.time);
  const weatherCodes = toArray(daily.weather_code);
  const precipitationProbability = toArray(daily.precipitation_probability_max);
  const precipitationSum = toArray(daily.precipitation_sum);
  const apparentTemperatureMax = toArray(daily.apparent_temperature_max);
  const apparentTemperatureMin = toArray(daily.apparent_temperature_min);
  const windSpeedMax = toArray(daily.wind_speed_10m_max);

  return dates.map((date, index) => ({
    day: index + 1,
    date: String(date),
    weatherCode: toNumberOrNull(weatherCodes[index]),
    precipitationProbabilityMax: toNumberOrNull(precipitationProbability[index]),
    precipitationSum: toNumberOrNull(precipitationSum[index]),
    apparentTemperatureMax: toNumberOrNull(apparentTemperatureMax[index]),
    apparentTemperatureMin: toNumberOrNull(apparentTemperatureMin[index]),
    windSpeedMax: toNumberOrNull(windSpeedMax[index]),
  }));
}

function parsePoints(input: string) {
  try {
    return RoutePointQuerySchema.parse(JSON.parse(input));
  }
  catch {
    return [];
  }
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function toArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function toNumberOrNull(input: unknown) {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
