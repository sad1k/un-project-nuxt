import { z } from "zod";

import { RouteConfidenceSchema, RoutePriceLevelSchema } from "~/lib/ai/route-contract";

export const PlaceDataSourceSchema = z.object({
  kind: z.enum(["route", "provider", "app", "ai", "missing"]),
  label: z.string().min(1).max(120),
  confidence: RouteConfidenceSchema.default("low"),
});

export const PlacePhotoSourceSchema = PlaceDataSourceSchema.refine(
  source => source.kind === "provider" || source.kind === "app",
  "Place photos must come from real provider or app-owned media.",
);

export const PlaceMissingDataSlotSchema = z.object({
  key: z.enum(["photo", "reviews", "rating", "cost", "community"]),
  label: z.string().min(1).max(80),
  message: z.string().min(1).max(200),
  source: PlaceDataSourceSchema,
});

export const PlacePhotoSchema = z.object({
  url: z.string().min(1),
  alt: z.string().min(1).max(180),
  attribution: z.string().max(220).optional(),
  source: PlacePhotoSourceSchema,
});

export const PlaceReviewSnippetSchema = z.object({
  authorLabel: z.string().min(1).max(80).optional(),
  text: z.string().min(1).max(500),
  relativeTime: z.string().min(1).max(80).optional(),
  rating: z.number().min(0).max(5).optional(),
  source: PlaceDataSourceSchema,
});

export const PlaceRatingSchema = z.object({
  value: z.number().min(0).max(5),
  scale: z.number().min(1).max(10).default(5),
  reviewCount: z.number().int().min(0).optional(),
  source: PlaceDataSourceSchema,
});

export const PlaceCostSignalSchema = z.object({
  level: RoutePriceLevelSchema,
  label: z.string().min(1).max(80),
  source: PlaceDataSourceSchema,
});

export const PlaceCommunitySignalSchema = z.object({
  visitCount: z.number().int().min(0),
  recentVisitCount: z.number().int().min(0),
  recentWindowHours: z.number().int().min(1).max(168),
  likelyCurrentlyThere: z.boolean().nullable(),
  label: z.string().min(1).max(140),
  source: PlaceDataSourceSchema,
});

export const PlaceWeatherReferenceSchema = z.object({
  label: z.string().min(1).max(120),
  source: PlaceDataSourceSchema,
}).optional();

export const PlaceIntelligenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  day: z.number().int().min(1).max(14).optional(),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    long: z.number().min(-180).max(180),
  }),
  routeRationale: z.string().max(500).optional(),
  photo: PlacePhotoSchema.nullable(),
  rating: PlaceRatingSchema.nullable(),
  reviews: z.array(PlaceReviewSnippetSchema).max(3),
  cost: PlaceCostSignalSchema.nullable(),
  community: PlaceCommunitySignalSchema.nullable(),
  aiSummary: z.object({
    text: z.string().min(1).max(700),
    summarySource: PlaceDataSourceSchema.extend({ kind: z.literal("ai") }),
  }).nullable(),
  weatherReference: PlaceWeatherReferenceSchema,
  missingSlots: z.array(PlaceMissingDataSlotSchema),
});

export type PlaceDataSource = z.infer<typeof PlaceDataSourceSchema>;
export type PlaceMissingDataSlot = z.infer<typeof PlaceMissingDataSlotSchema>;
export type PlacePhoto = z.infer<typeof PlacePhotoSchema>;
export type PlaceReviewSnippet = z.infer<typeof PlaceReviewSnippetSchema>;
export type PlaceRating = z.infer<typeof PlaceRatingSchema>;
export type PlaceCostSignal = z.infer<typeof PlaceCostSignalSchema>;
export type PlaceCommunitySignal = z.infer<typeof PlaceCommunitySignalSchema>;
export type PlaceWeatherReference = z.infer<typeof PlaceWeatherReferenceSchema>;
export type PlaceIntelligence = z.infer<typeof PlaceIntelligenceSchema>;

export type PlaceProviderData = {
  photo?: PlacePhoto | null;
  rating?: PlaceRating | null;
  reviews?: PlaceReviewSnippet[];
  cost?: PlaceCostSignal | null;
  aiSummary?: {
    text: string;
    summarySource: PlaceDataSource & { kind: "ai" };
  } | null;
};

export type PlaceIntelligenceInput = {
  id: string;
  name: string;
  day?: number;
  coordinates: {
    lat: number;
    long: number;
  };
  route?: {
    rationale?: string;
    estimatedPriceLevel?: PlaceCostSignal["level"];
    priceConfidence?: PlaceDataSource["confidence"];
    priceSource?: string;
  };
  provider?: PlaceProviderData | null;
  community?: PlaceCommunitySignal | null;
  aiSummary?: PlaceProviderData["aiSummary"];
  weatherReference?: PlaceWeatherReference;
};

const MISSING_SOURCE: PlaceDataSource = {
  kind: "missing",
  label: "Нет данных из источников",
  confidence: "low",
};

export function buildPlaceIntelligence(input: PlaceIntelligenceInput): PlaceIntelligence {
  const rating = input.provider?.rating ?? null;
  const reviews = (input.provider?.reviews?.slice(0, 3) ?? []).map(review => ({
    ...review,
    text: review.text.length > 500 ? `${review.text.slice(0, 497).trimEnd()}…` : review.text,
  }));
  const cost = input.provider?.cost ?? buildRouteCostSignal(input.route);
  const community = input.community && input.community.visitCount > 0 ? input.community : null;
  const aiSummary = input.aiSummary ?? input.provider?.aiSummary ?? null;

  return PlaceIntelligenceSchema.parse({
    id: input.id,
    name: input.name,
    day: input.day,
    coordinates: input.coordinates,
    routeRationale: input.route?.rationale,
    photo: input.provider?.photo ?? null,
    rating,
    reviews,
    cost,
    community,
    aiSummary,
    weatherReference: input.weatherReference,
    missingSlots: createMissingSlots({
      hasPhoto: Boolean(input.provider?.photo),
      hasReviews: reviews.length > 0,
      hasRating: Boolean(rating),
      hasCost: Boolean(cost),
      hasCommunity: Boolean(community),
    }),
  });
}

export function createUnavailablePlaceIntelligence(input: {
  id: string;
  name: string;
  day?: number;
  coordinates: { lat: number; long: number };
  rationale?: string;
}): PlaceIntelligence {
  return buildPlaceIntelligence({
    id: input.id,
    name: input.name,
    day: input.day,
    coordinates: input.coordinates,
    route: {
      rationale: input.rationale,
    },
  });
}

function buildRouteCostSignal(route: PlaceIntelligenceInput["route"]): PlaceCostSignal | null {
  if (!route?.estimatedPriceLevel || route.estimatedPriceLevel === "unknown")
    return null;

  return {
    level: route.estimatedPriceLevel,
    label: formatPriceLevel(route.estimatedPriceLevel),
    source: {
      kind: "route",
      label: route.priceSource || "Оценка AI-маршрута",
      confidence: route.priceConfidence || "low",
    },
  };
}

function createMissingSlots(input: {
  hasPhoto: boolean;
  hasReviews: boolean;
  hasRating: boolean;
  hasCost: boolean;
  hasCommunity: boolean;
}): PlaceMissingDataSlot[] {
  return [
    missingWhen(!input.hasPhoto, "photo", "Фото недоступно", "Пока нет фото места из источников."),
    missingWhen(!input.hasReviews, "reviews", "Отзывы недоступны", "Пока нет фрагментов отзывов из источников."),
    missingWhen(!input.hasRating, "rating", "Рейтинг недоступен", "Пока нет рейтинга из источников."),
    missingWhen(!input.hasCost, "cost", "Стоимость недоступна", "Пока нет сигнала о стоимости из источников."),
    missingWhen(!input.hasCommunity, "community", "Сигнал сообщества недоступен", "Недостаточно агрегированных посещений в приложении для оценки текущей активности."),
  ].filter((slot): slot is PlaceMissingDataSlot => Boolean(slot));
}

function missingWhen(
  condition: boolean,
  key: PlaceMissingDataSlot["key"],
  label: string,
  message: string,
) {
  if (!condition)
    return null;

  return {
    key,
    label,
    message,
    source: MISSING_SOURCE,
  };
}

export function formatPriceLevel(level: PlaceCostSignal["level"]): string {
  const labels: Record<PlaceCostSignal["level"], string> = {
    free: "Бесплатно",
    low: "Низкая стоимость",
    medium: "Средняя стоимость",
    high: "Высокая стоимость",
    unknown: "Стоимость неизвестна",
  };

  return labels[level];
}
