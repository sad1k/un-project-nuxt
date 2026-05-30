import { z } from "zod";

import type { ExploreRequestContext } from "~/lib/explore/context";

export const RouteConfidenceSchema = z.enum(["low", "medium", "high"]);

export const RoutePriceLevelSchema = z.enum([
  "free",
  "low",
  "medium",
  "high",
  "unknown",
]);

const ExploreCoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
});

const ExploreInterestSchema = z.enum([
  "culture",
  "food",
  "nature",
  "adventure",
  "art",
  "nightlife",
  "shopping",
  "family",
  "hidden-gems",
]);

const SelectedExploreCitySchema = z.object({
  id: z.string().min(1),
  provider: z.enum(["mapbox", "nominatim"]),
  providerId: z.string().min(1),
  label: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  coordinates: ExploreCoordinatesSchema,
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  source: z.enum(["provider", "fallback"]).optional(),
});

const ExploreCandidatePlaceSchema = z.object({
  id: z.string().min(1),
  provider: z.string().optional(),
  providerId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  coordinates: ExploreCoordinatesSchema.optional(),
  categories: z.array(ExploreInterestSchema),
  source: z.enum(["provider", "saved", "diary", "fallback"]),
  selected: z.boolean(),
});

const ExploreAnchorPointSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  coordinates: ExploreCoordinatesSchema,
  day: z.number().int().min(1).max(14),
});

export const ExploreRequestContextSchema = z.object({
  city: SelectedExploreCitySchema.nullable(),
  selectedDays: z.number().int().min(1).max(14),
  interests: z.array(ExploreInterestSchema).max(12),
  filters: z.object({
    query: z.string().max(200),
    interests: z.array(ExploreInterestSchema).max(12),
    includeSavedPlaces: z.boolean(),
    includeCandidatePlaces: z.boolean(),
  }),
  currentLocation: z.object({
    enabled: z.boolean(),
    coordinates: ExploreCoordinatesSchema.optional(),
  }),
  selectedSavedPlaceIds: z.array(z.number().int().positive()).max(50),
  selectedDiaryLogIds: z.array(z.number().int().positive()).max(50),
  candidatePlaces: z.array(ExploreCandidatePlaceSchema).max(50),
  anchorPoints: z.array(ExploreAnchorPointSchema).max(25).optional(),
}) satisfies z.ZodType<ExploreRequestContext>;

export const RouteGenerationRequestSchema = z.object({
  context: ExploreRequestContextSchema,
  sessionId: z.number().int().positive().optional(),
  activeVariantId: z.number().int().positive().optional(),
  followUpMessage: z.string().trim().min(1).max(1000).optional(),
}).superRefine((value, ctx) => {
  if (!value.sessionId && !value.context.city && !value.context.anchorPoints?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Для первой генерации маршрута нужно выбрать город или отметить точки на карте.",
      path: ["context", "city"],
    });
  }
});

export const RoutePointSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  day: z.number().int().min(1).max(14),
  coordinates: ExploreCoordinatesSchema,
  estimatedStart: z.string().trim().min(1).max(40).optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(720).optional(),
  rationale: z.string().trim().min(1).max(500),
  confidence: RouteConfidenceSchema,
  alternativeForPointId: z.string().min(1).max(80).optional(),
  approximateDistanceMeters: z.number().int().min(0).optional(),
  estimatedPriceLevel: RoutePriceLevelSchema.optional(),
  priceConfidence: RouteConfidenceSchema.optional(),
  priceSource: z.string().trim().min(1).max(160).optional(),
}).superRefine((value, ctx) => {
  if (value.estimatedPriceLevel && value.estimatedPriceLevel !== "unknown") {
    if (!value.priceConfidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для оценки стоимости нужны метаданные уверенности.",
        path: ["priceConfidence"],
      });
    }

    if (!value.priceSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для оценки стоимости нужны метаданные источника.",
        path: ["priceSource"],
      });
    }
  }
});

export const RoutePointPatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  day: z.number().int().min(1).max(14).optional(),
  coordinates: ExploreCoordinatesSchema.optional(),
  estimatedStart: z.string().trim().min(1).max(40).optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(720).optional(),
  rationale: z.string().trim().min(1).max(500).optional(),
}).refine(
  patch => Object.values(patch).some(value => value !== undefined),
  { message: "Нужно передать хотя бы одно поле для изменения точки." }, // at least one field
);

export type RoutePointPatch = z.infer<typeof RoutePointPatchSchema>;

const RouteEventBaseSchema = z.object({
  sequence: z.number().int().min(0),
  sessionId: z.number().int().positive().optional(),
  variantId: z.number().int().positive().optional(),
});

export const RouteSessionCreatedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.session.created"),
  sessionId: z.number().int().positive(),
  activeVariantId: z.number().int().positive().optional(),
});

export const RouteVariantStartedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.variant.started"),
  sessionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  parentVariantId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(160).optional(),
});

export const RoutePointAddedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.point.added"),
  sessionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  point: RoutePointSchema,
});

export const RoutePointUpdatedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.point.updated"),
  sessionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  point: RoutePointSchema,
});

export const RouteVariantCompletedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.variant.completed"),
  sessionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().min(1).max(1000).optional(),
});

export const RouteWarningEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.warning"),
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  recoverable: z.boolean().default(true),
});

export const RouteFailedEventSchema = RouteEventBaseSchema.extend({
  type: z.literal("route.failed"),
  sessionId: z.number().int().positive().optional(),
  variantId: z.number().int().positive().optional(),
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
});

export const RouteEventEnvelopeSchema = z.discriminatedUnion("type", [
  RouteSessionCreatedEventSchema,
  RouteVariantStartedEventSchema,
  RoutePointAddedEventSchema,
  RoutePointUpdatedEventSchema,
  RouteVariantCompletedEventSchema,
  RouteWarningEventSchema,
  RouteFailedEventSchema,
]);

export type RouteGenerationRequest = z.infer<typeof RouteGenerationRequestSchema>;
export type RoutePoint = z.infer<typeof RoutePointSchema>;
export type RouteEventEnvelope = z.infer<typeof RouteEventEnvelopeSchema>;
export type RoutePointEvent = z.infer<typeof RoutePointAddedEventSchema> | z.infer<typeof RoutePointUpdatedEventSchema>;
export type RouteWarningEvent = z.infer<typeof RouteWarningEventSchema>;

export function isRoutePointEvent(event: RouteEventEnvelope): event is RoutePointEvent {
  return event.type === "route.point.added" || event.type === "route.point.updated";
}

export function createRouteWarningEvent(input: {
  sequence: number;
  code: string;
  message: string;
  sessionId?: number;
  variantId?: number;
  recoverable?: boolean;
}): RouteWarningEvent {
  return RouteWarningEventSchema.parse({
    type: "route.warning",
    recoverable: true,
    ...input,
  });
}
