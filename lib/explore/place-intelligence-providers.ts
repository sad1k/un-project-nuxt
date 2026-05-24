import type { PlaceCostSignal, PlacePhoto, PlaceProviderData, PlaceRating, PlaceReviewSnippet } from "~/lib/explore/place-intelligence";

import env from "~/lib/env";
import { formatPriceLevel } from "~/lib/explore/place-intelligence";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GOOGLE_PLACES_LANGUAGE_CODE = "ru";
const GOOGLE_PLACES_REGION_CODE = "RU";
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

const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";

export type ProviderResult = {
  available: boolean;
  data?: PlaceProviderData;
  reason?: string;
};

export type GooglePlacePhotoResult = {
  url: string;
  alt: string;
  attribution?: string;
  providerPlaceId?: string;
  providerPhotoReference: string;
};

export type WikimediaPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
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

export async function fetchGooglePlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
}): Promise<GooglePlacePhotoResult | null> {
  if (!env.GOOGLE_PLACES_API_KEY) {
    logGooglePlacePhotoDebug("not_configured", input);
    return null;
  }

  try {
    logGooglePlacePhotoDebug("search_start", input);
    const place = await searchGooglePlace(input);
    if (!place) {
      logGooglePlacePhotoDebug("search_no_match", input);
      return null;
    }

    logGooglePlacePhotoDebug("search_match", {
      ...input,
      hasPlaceId: typeof place.id === "string",
      hasPhotos: Array.isArray(place.photos) && place.photos.length > 0,
    });
    const details = typeof place.id === "string" ? await fetchGooglePlaceDetails(place.id) : place;
    const resolvedPlace = details || place;
    const photo = normalizePhoto(resolvedPlace, input.name, {
      kind: "provider",
      label: "Google Places",
      confidence: "medium",
    });
    if (!photo) {
      logGooglePlacePhotoDebug("details_no_photo", {
        ...input,
        usedDetails: Boolean(details),
        hasPhotos: Array.isArray(resolvedPlace.photos) && resolvedPlace.photos.length > 0,
      });
      return null;
    }

    const photos = Array.isArray(resolvedPlace.photos) ? resolvedPlace.photos.filter(isRecord) : [];
    const firstPhoto = photos[0];
    const providerPhotoReference = typeof firstPhoto?.name === "string" ? firstPhoto.name : "";
    if (!providerPhotoReference) {
      logGooglePlacePhotoDebug("photo_reference_missing", input);
      return null;
    }

    logGooglePlacePhotoDebug("photo_hit", {
      ...input,
      hasAttribution: Boolean(photo.attribution),
    });
    return {
      url: photo.url,
      alt: photo.alt,
      attribution: photo.attribution,
      providerPlaceId: typeof resolvedPlace.id === "string" ? resolvedPlace.id : undefined,
      providerPhotoReference,
    };
  }
  catch (error) {
    logGooglePlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function fetchWikimediaPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
}): Promise<WikimediaPlacePhotoResult | null> {
  try {
    logWikimediaPlacePhotoDebug("search_start", input);
    const url = new URL(WIKIMEDIA_API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "geosearch");
    url.searchParams.set("prop", "coordinates|pageimages");
    url.searchParams.set("ggscoord", `${input.lat}|${input.long}`);
    url.searchParams.set("ggsradius", String(Math.min(Math.max(input.radiusMeters ?? 250, 50), 1000)));
    url.searchParams.set("ggslimit", "10");
    url.searchParams.set("pithumbsize", "720");
    url.searchParams.set("pilicense", "any");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WanderLog/1.0 real-place-photo-fallback",
      },
    });
    if (!response.ok) {
      logWikimediaPlacePhotoDebug("search_http_error", {
        ...input,
        status: response.status,
      });
      return null;
    }

    const payload = await response.json();
    const page = selectBestWikimediaPhotoPage(payload, input);
    if (!page) {
      logWikimediaPlacePhotoDebug("search_no_safe_photo", input);
      return null;
    }

    const thumbnail = isRecord(page.thumbnail) ? page.thumbnail : {};
    const source = typeof thumbnail.source === "string" ? thumbnail.source : "";
    const title = typeof page.title === "string" ? page.title : input.name;
    const pageId = typeof page.pageid === "number" ? String(page.pageid) : title;
    const confidence = scoreWikimediaMatch(input.name, title);

    logWikimediaPlacePhotoDebug("photo_hit", {
      name: input.name,
      title,
      matchConfidence: confidence,
    });

    return {
      url: source,
      alt: `Photo from Wikimedia: ${title}`,
      attribution: `Wikimedia: ${title}`,
      providerPlaceId: pageId,
      providerPhotoReference: title,
      matchConfidence: confidence,
    };
  }
  catch (error) {
    logWikimediaPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
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
      languageCode: GOOGLE_PLACES_LANGUAGE_CODE,
      regionCode: GOOGLE_PLACES_REGION_CODE,
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

  if (!response.ok) {
    logGooglePlacePhotoDebug("search_http_error", {
      ...input,
      status: response.status,
    });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.places))
    return null;

  return payload.places.find(isRecord) ?? null;
}

async function fetchGooglePlaceDetails(placeId: string) {
  const url = new URL(`${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", GOOGLE_PLACES_LANGUAGE_CODE);
  url.searchParams.set("regionCode", GOOGLE_PLACES_REGION_CODE);

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY || "",
      "X-Goog-FieldMask": GOOGLE_PLACE_DETAIL_FIELDS,
    },
  });

  if (!response.ok) {
    logGooglePlacePhotoDebug("details_http_error", {
      placeIdLength: placeId.length,
      status: response.status,
    });
    return null;
  }

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
    alt: `Фото места: ${fallbackName}`,
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
      text: text || "Фрагмент отзыва из источника недоступен.",
      relativeTime: typeof review.relativePublishTimeDescription === "string"
        ? review.relativePublishTimeDescription
        : undefined,
      rating: typeof review.rating === "number" ? review.rating : undefined,
      source,
    };
  }).filter(review => review.text !== "Фрагмент отзыва из источника недоступен.");
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
      label: "Сводка Google Places",
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

function logGooglePlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[google-place-photo]", stage, details);
}

function selectBestWikimediaPhotoPage(payload: unknown, input: { name: string }) {
  if (!isRecord(payload) || !isRecord(payload.query) || !isRecord(payload.query.pages))
    return null;

  const pages = Object.values(payload.query.pages).filter(isRecord);
  const candidates = pages
    .filter((page) => {
      const thumbnail = isRecord(page.thumbnail) ? page.thumbnail : {};
      return typeof thumbnail.source === "string" && thumbnail.source.startsWith("https://");
    })
    .map(page => ({
      page,
      score: scoreWikimediaPage(input.name, page),
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.page ?? null;
}

function scoreWikimediaPage(inputName: string, page: Record<string, unknown>) {
  const title = typeof page.title === "string" ? page.title : "";
  const matchConfidence = scoreWikimediaMatch(inputName, title);
  if (matchConfidence === "high")
    return 3;
  if (matchConfidence === "medium")
    return 2;

  const coordinates = Array.isArray(page.coordinates) ? page.coordinates.filter(isRecord) : [];
  const firstCoordinate = coordinates[0];
  const distance = typeof firstCoordinate?.dist === "number" ? firstCoordinate.dist : undefined;
  return typeof distance === "number" && distance <= 75 ? 1 : 0;
}

function scoreWikimediaMatch(inputName: string, title: string): "low" | "medium" | "high" {
  const normalizedInput = normalizeSearchText(inputName);
  const normalizedTitle = normalizeSearchText(title);
  if (!normalizedInput || !normalizedTitle)
    return "low";

  if (normalizedInput === normalizedTitle)
    return "high";

  if (normalizedInput.includes(normalizedTitle) || normalizedTitle.includes(normalizedInput))
    return "medium";

  const inputTokens = new Set(normalizedInput.split(" ").filter(token => token.length > 3));
  const titleTokens = normalizedTitle.split(" ").filter(token => token.length > 3);
  const overlap = titleTokens.filter(token => inputTokens.has(token)).length;
  return overlap >= 2 ? "medium" : "low";
}

function normalizeSearchText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function logWikimediaPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[wikimedia-place-photo]", stage, details);
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
