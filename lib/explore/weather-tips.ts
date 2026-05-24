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
  label: "Прогноз Open-Meteo",
  confidence: "medium" as const,
};

export function buildRouteWeatherTips(input: {
  forecastDays: WeatherForecastDay[];
  selectedDays: number;
  cityLabel?: string;
}): RouteWeatherTips {
  if (!input.forecastDays.length)
    return createUnavailableRouteWeatherTips("Прогноз погоды недоступен для этого маршрута.");

  const tips = input.forecastDays.flatMap(day => buildTipsForForecastDay(day));
  if (input.selectedDays > 1) {
    tips.unshift({
      id: "multi-day-route",
      severity: "info",
      title: "Погода на многодневном маршруте",
      body: `Проверяйте каждый день перед выходом: условия могут меняться в течение ${input.selectedDays}-дневного маршрута.`,
      whatToTake: ["Слой одежды по погоде", "Бутылка для воды"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (!tips.length) {
    tips.push({
      id: "mild-weather",
      severity: "info",
      title: "Погода выглядит управляемой",
      body: "Для выбранного окна маршрута нет сильных сигналов дождя, жары, холода или ветра.",
      whatToTake: ["Удобная обувь", "Вода"],
      source: OPEN_METEO_SOURCE,
    });
  }

  return RouteWeatherTipsSchema.parse({
    status: "available",
    summary: input.cityLabel
      ? `Погодные советы для ${input.cityLabel}.`
      : "Погодные советы для этого маршрута.",
    tips: tips.slice(0, 12),
    source: OPEN_METEO_SOURCE,
  });
}

export function createUnavailableRouteWeatherTips(reason = "Данные о погоде сейчас недоступны."): RouteWeatherTips {
  return RouteWeatherTipsSchema.parse({
    status: "unavailable",
    summary: reason,
    tips: [{
      id: "weather-unavailable",
      severity: "info",
      title: "Погода недоступна",
      body: "Данных прогноза нет, поэтому не делайте выводы об условиях только по маршруту.",
      whatToTake: ["Проверить местный прогноз", "Взять лёгкий слой одежды"],
      unavailable: true,
      source: {
        label: "Погода недоступна",
        confidence: "low",
      },
    }],
    source: {
      label: "Погода недоступна",
      confidence: "low",
    },
  });
}

function buildTipsForForecastDay(day: WeatherForecastDay): RouteWeatherTip[] {
  const tips: RouteWeatherTip[] = [];
  const dayLabel = `День ${day.day}`;

  if (isRainy(day)) {
    tips.push({
      id: `rain-${day.day}`,
      day: day.day,
      severity: getSevereWeatherCode(day.weatherCode) ? "high" : "caution",
      title: `${dayLabel}: подготовка к дождю`,
      body: "На маршруте возможен дождь; прогулка может стать медленнее, а остановки на улице менее комфортными.",
      whatToTake: ["Зонт", "Дождевой слой", "Водоотталкивающая обувь"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.apparentTemperatureMax === "number" && day.apparentTemperatureMax >= 30) {
    tips.push({
      id: `heat-${day.day}`,
      day: day.day,
      severity: day.apparentTemperatureMax >= 35 ? "high" : "caution",
      title: `${dayLabel}: жара и солнце`,
      body: "Высокая ощущаемая температура может усложнить долгие прогулки, особенно на открытых участках.",
      whatToTake: ["Вода", "Защита от солнца", "Дышащая одежда"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.apparentTemperatureMin === "number" && day.apparentTemperatureMin <= 5) {
    tips.push({
      id: `cold-${day.day}`,
      day: day.day,
      severity: day.apparentTemperatureMin <= -5 ? "high" : "caution",
      title: `${dayLabel}: защита от холода`,
      body: "Низкая ощущаемая температура может сделать ожидание на улице некомфортным.",
      whatToTake: ["Тёплый слой", "Перчатки или шапка"],
      source: OPEN_METEO_SOURCE,
    });
  }

  if (typeof day.windSpeedMax === "number" && day.windSpeedMax >= 35) {
    tips.push({
      id: `wind-${day.day}`,
      day: day.day,
      severity: day.windSpeedMax >= 55 ? "high" : "caution",
      title: `${dayLabel}: осторожно, ветер`,
      body: "Сильный ветер может сделать мосты, набережные и открытые обзорные точки менее комфортными.",
      whatToTake: ["Ветрозащитный слой", "Закрепить шапку и лёгкие вещи"],
      source: OPEN_METEO_SOURCE,
    });
  }

  const severeCode = getSevereWeatherCode(day.weatherCode);
  if (severeCode && !tips.some(tip => tip.id === `rain-${day.day}`)) {
    tips.push({
      id: `severe-${day.day}`,
      day: day.day,
      severity: "high",
      title: `${dayLabel}: риск суровой погоды`,
      body: severeCode,
      whatToTake: ["Запасной вариант в помещении", "Проверка местного прогноза"],
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
    return "Грозовые условия могут повлиять на остановки на улице.";

  if (weatherCode === 82)
    return "Сильные ливни могут повлиять на остановки на улице.";

  if (weatherCode === 75 || weatherCode === 77 || weatherCode === 86)
    return "Снег или лёд могут повлиять на комфорт прогулки.";

  return "";
}
