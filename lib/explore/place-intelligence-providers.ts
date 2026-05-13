import type { PlaceCostSignal, PlacePhoto, PlaceProviderData, PlaceRating, PlaceReviewSnippet } from "~/lib/explore/place-intelligence";

import env from "~/lib/env";
import { formatPriceLevel } from "~/lib/explore/place-intelligence";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GOOGLE_PLACE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.photos",
  "places.rating",
  "places.userRatingCount",
  "places.reviews",
  "places.priceLevel",
  "places.generativeSummary",
].join(",");

const GOOGLE_PLACE_DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "photos",
  "rating",
  "userRatingCount",
  "reviews",
  "priceLevel",
  "generativeSummary",
].join(",");

export type ProviderResult = {
  available: boolean;
  data?: PlaceProviderData;
  reason?: string;
};

export async function fetchGooglePlaceIntelligence(input: {
  name: string;
  lat: number;
  long: number;
}): Promise<ProviderResult> {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return {
      available: false,
      reason: "google_places_not_configured",
    };
  }

  try {
    const place = await searchGooglePlace(input);
    if (!place) {
      return {
        available: false,
        reason: "google_places_no_match",
      };
    }

    const details = typeof place.id === "string" ? await fetchGooglePlaceDetails(place.id) : place;

    return {
      available: true,
      data: normalizeGooglePlaceDetails(details || place, input.name),
    };
  }
  catch {
    return {
      available: false,
      reason: "google_places_unavailable",
    };
  }
}

async function searchGooglePlace(input: { name: string; lat: number; long: number }) {
  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY || "",
      "X-Goog-FieldMask": GOOGLE_PLACE_FIELDS,
    },
    body: JSON.stringify({
      textQuery: input.name,
      locationBias: {
        circle: {
          center: {
            latitude: input.lat,
            longitude: input.long,
          },
          radius: 700,
        },
      },
    }),
  });

  if (!response.ok)
    return null;

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.places))
    return null;

  return payload.places.find(isRecord) ?? null;
}

async function fetchGooglePlaceDetails(placeId: string) {
  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY || "",
      "X-Goog-FieldMask": GOOGLE_PLACE_DETAIL_FIELDS,
    },
  });

  if (!response.ok)
    return null;

  const payload = await response.json();
  return isRecord(payload) ? payload : null;
}

export function normalizeGooglePlaceDetails(place: Record<string, unknown>, fallbackName: string): PlaceProviderData {
  const source = {
    kind: "provider" as const,
    label: "Google Places",
    confidence: "medium" as const,
  };

  return {
    photo: normalizePhoto(place, fallbackName, source),
    rating: normalizeRating(place, source),
    reviews: normalizeReviews(place, source),
    cost: normalizeCost(place, source),
    aiSummary: normalizeGenerativeSummary(place),
  };
}

function normalizePhoto(
  place: Record<string, unknown>,
  fallbackName: string,
  source: PlacePhoto["source"],
): PlacePhoto | null {
  const photos = Array.isArray(place.photos) ? place.photos.filter(isRecord) : [];
  const firstPhoto = photos[0];
  const photoName = typeof firstPhoto?.name === "string" ? firstPhoto.name : "";
  if (!photoName)
    return null;

  return {
    url: `/api/explore/place-photo?name=${encodeURIComponent(photoName)}`,
    alt: `${fallbackName} place photo`,
    attribution: normalizePhotoAttribution(firstPhoto),
    source,
  };
}

function normalizeRating(
  place: Record<string, unknown>,
  source: PlaceRating["source"],
): PlaceRating | null {
  if (typeof place.rating !== "number")
    return null;

  return {
    value: place.rating,
    scale: 5,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
    source,
  };
}

function normalizeReviews(
  place: Record<string, unknown>,
  source: PlaceReviewSnippet["source"],
): PlaceReviewSnippet[] {
  const reviews = Array.isArray(place.reviews) ? place.reviews.filter(isRecord) : [];

  return reviews.slice(0, 3).map((review) => {
    const authorAttribution = isRecord(review.authorAttribution) ? review.authorAttribution : {};
    const text = normalizeLocalizedText(review.text);

    return {
      authorLabel: typeof authorAttribution.displayName === "string" ? authorAttribution.displayName : undefined,
      text: text || "Sourced review snippet unavailable.",
      relativeTime: typeof review.relativePublishTimeDescription === "string"
        ? review.relativePublishTimeDescription
        : undefined,
      rating: typeof review.rating === "number" ? review.rating : undefined,
      source,
    };
  }).filter(review => review.text !== "Sourced review snippet unavailable.");
}

function normalizeCost(
  place: Record<string, unknown>,
  source: PlaceCostSignal["source"],
): PlaceCostSignal | null {
  const level = normalizePriceLevel(place.priceLevel);
  if (!level)
    return null;

  return {
    level,
    label: formatPriceLevel(level),
    source,
  };
}

function normalizeGenerativeSummary(place: Record<string, unknown>): PlaceProviderData["aiSummary"] {
  const summary = normalizeLocalizedText(place.generativeSummary);
  if (!summary)
    return null;

  return {
    text: summary,
    summarySource: {
      kind: "ai",
      label: "Google Places generative summary",
      confidence: "medium",
    },
  };
}

function normalizeLocalizedText(input: unknown) {
  if (typeof input === "string")
    return input.trim();

  if (!isRecord(input))
    return "";

  if (typeof input.text === "string")
    return input.text.trim();

  if (isRecord(input.overview) && typeof input.overview.text === "string")
    return input.overview.text.trim();

  return "";
}

function normalizePhotoAttribution(photo: Record<string, unknown>) {
  const authorAttributions = Array.isArray(photo.authorAttributions)
    ? photo.authorAttributions.filter(isRecord)
    : [];
  const labels = authorAttributions
    .map(attribution => typeof attribution.displayName === "string" ? attribution.displayName : "")
    .filter(Boolean);

  return labels.length ? labels.join(", ") : undefined;
}

function normalizePriceLevel(input: unknown): PlaceCostSignal["level"] | null {
  const levels: Record<string, PlaceCostSignal["level"]> = {
    PRICE_LEVEL_FREE: "free",
    PRICE_LEVEL_INEXPENSIVE: "low",
    PRICE_LEVEL_MODERATE: "medium",
    PRICE_LEVEL_EXPENSIVE: "high",
    PRICE_LEVEL_VERY_EXPENSIVE: "high",
  };

  return typeof input === "string" ? levels[input] ?? null : null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
