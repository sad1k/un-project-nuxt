import type { PlaceCostSignal, PlacePhoto, PlaceProviderData, PlaceRating, PlaceReviewSnippet } from "~/lib/explore/place-intelligence";

import env from "~/lib/env";
import { formatPriceLevel } from "~/lib/explore/place-intelligence";
import { isTripAdvisorQuotaExceeded, recordTripAdvisorCall } from "~/lib/explore/provider-quota";

const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const GOOGLE_PLACES_LANGUAGE_CODE = "ru";
const GOOGLE_PLACES_REGION_CODE = "RU";
// Full "Enterprise + Atmosphere" field mask. Only the place-intelligence popup needs
// ratings/reviews/price/AI summary, so the cost of that billing tier is paid here alone.
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

// Photo lookups only need an id + photo references, which stays in the cheaper "Pro"
// tier instead of paying for the Atmosphere fields the photo path never reads.
const GOOGLE_PLACE_PHOTO_FIELDS = [
  "places.id",
  "places.photos",
].join(",");

const TWOGIS_BASE_URL = "https://catalog.api.2gis.com/3.0/items";
const TWOGIS_LOCALE = "ru_RU";
// The public 2GIS Catalog API only exposes rating + review counts (no photos, review text,
// or price), so we request just the reviews block and use it as the RU rating signal.
const TWOGIS_FIELDS = "items.reviews";

// 2GIS's official Catalog API exposes no review text, so review snippets come from the same
// unofficial endpoint the 2GIS website itself uses. Best-effort + fail-soft: undocumented and
// can change without notice. The branch id is the Catalog item id we already fetch.
const TWOGIS_REVIEWS_BASE_URL = "https://public-api.reviews.2gis.com/2.0/branches";
// The public key 2GIS ships in its own web client; override via env if it ever rotates.
const TWOGIS_REVIEWS_PUBLIC_KEY = "37c04fe6-a560-4549-b459-02309cf643ad";
const TWOGIS_REVIEWS_TIMEOUT_MS = 5000;
// The endpoint 403s a request with no/bot-like User-Agent, so send a browser-like one.
const TWOGIS_REVIEWS_USER_AGENT = "Mozilla/5.0 (compatible; WanderLog/1.0)";
const TWOGIS_REVIEWS_MAX = 3;

const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";

const MAPILLARY_IMAGES_API_URL = "https://graph.mapillary.com/images";
// Mapillary returns HTTP 500 ("reduce the amount of data you're asking for") when a bbox
// covers too many captures — a 250m box over central Moscow fails outright (verified against
// the live API). So we search a *tight* box and widen the radius only when the smaller one is
// empty: dense areas resolve at 30m (fast, and they never reach a radius that would 500),
// sparse areas escalate to 60m.
const MAPILLARY_SEARCH_RADII_METERS = [30, 60];
// The degree-width of a metre grows toward the poles, so clamp each half-span in *degrees*
// (not metres) as a safety ceiling that keeps the box well under Mapillary's 0.01°/side limit
// at any latitude. It only binds far north; at Moscow the metric radii above drive the box.
const MAPILLARY_MAX_HALF_SPAN_DEG = 0.001;
// Mapillary returns street-level frames captured *near* a coordinate, not photos verified to
// depict the venue, so distance is the only signal we have — and it never earns "high".
const MAPILLARY_MEDIUM_CONFIDENCE_METERS = 25;

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
// Wikidata Query Service is a public, rate-limited endpoint and SPARQL can be slow, so cap the
// wait — a sluggish WDQS must never stall the sequential resolver chain. It's a cached fallback.
const WIKIDATA_QUERY_TIMEOUT_MS = 5000;

const WIKIMAPIA_API_URL = "https://api.wikimapia.org/";
// Wikimapia photos are attached to a specific object (building/landmark), so they depict the
// place itself — unlike Mapillary's street-level frames. But place.getnearest returns no photos
// and place.getbyid needs an id, so a lookup is inherently two requests. It's a cached fallback,
// so the extra round-trip is fine. Cap candidate distance so we don't grab a far-off object.
const WIKIMAPIA_MAX_DISTANCE_METERS = 200;

const FLICKR_API_URL = "https://api.flickr.com/services/rest/";
const FLICKR_QUERY_TIMEOUT_MS = 5000;
// Flickr's radius is in km and capped at 32. A geo search also needs a "limiting agent" or it
// only returns the last 12h of uploads — passing the place name as `text` satisfies that and
// keeps results name-relevant.
const FLICKR_MAX_RADIUS_KM = 32;
// Only surface openly-licensed media: every Flickr license id except 0 (All Rights Reserved) —
// CC variants (1-6), no-known-restrictions (7), US Government (8), and public domain (9-10).
const FLICKR_REUSABLE_LICENSES = "1,2,3,4,5,6,7,8,9,10";

const TRIPADVISOR_API_URL = "https://api.content.tripadvisor.com/api/v1";
const TRIPADVISOR_QUERY_TIMEOUT_MS = 5000;
const TRIPADVISOR_LANGUAGE = "ru";

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

export type MapillaryPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
};

export type WikimapiaPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
};

export type WikidataPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
};

export type FlickrPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
};

export type TripAdvisorPlacePhotoResult = {
  url: string;
  alt: string;
  attribution: string;
  providerPlaceId: string;
  providerPhotoReference: string;
  matchConfidence: "low" | "medium" | "high";
  // Up to 5 photos (hero at [0]) from the same billable photos call — powers the carousel.
  gallery: string[];
};

export async function fetchPlaceIntelligence(input: {
  name: string;
  lat: number;
  long: number;
}, options: { withReviews?: boolean } = {}): Promise<ProviderResult> {
  // Prefer 2GIS (better RU coverage and avoids Google's paid Atmosphere tier). Fall back
  // to Google when 2GIS has no key configured, no match, or no rating for this place.
  if (env.TWOGIS_API_KEY) {
    const twoGisResult = await fetch2GisPlaceIntelligence(input, options);
    if (twoGisResult.available)
      return twoGisResult;
  }

  return fetchGooglePlaceIntelligence(input);
}

export async function fetch2GisPlaceIntelligence(input: {
  name: string;
  lat: number;
  long: number;
}, options: { withReviews?: boolean } = {}): Promise<ProviderResult> {
  if (!env.TWOGIS_API_KEY) {
    return {
      available: false,
      reason: "twogis_not_configured",
    };
  }

  try {
    const item = await search2GisPlace(input);
    if (!item) {
      return {
        available: false,
        reason: "twogis_no_match",
      };
    }

    const data = normalize2GisPlace(item);
    if (!data.rating) {
      return {
        available: false,
        reason: "twogis_no_rating",
      };
    }

    // Review text is a separate (unofficial, free) call; only spend it on the full
    // panel/sheet — the hover popup passes withReviews=false and stays light.
    if (options.withReviews) {
      const branchId = parse2GisBranchId(item.id);
      if (branchId)
        data.reviews = await fetch2GisBranchReviews(branchId);
    }

    return {
      available: true,
      data,
    };
  }
  catch {
    return {
      available: false,
      reason: "twogis_unavailable",
    };
  }
}

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
    // Text Search already returns every field in GOOGLE_PLACE_FIELDS, so a follow-up
    // Place Details request would only re-bill the same Atmosphere fields for no new data.
    const place = await searchGooglePlace(input);
    if (!place) {
      return {
        available: false,
        reason: "google_places_no_match",
      };
    }

    return {
      available: true,
      data: normalizeGooglePlaceDetails(place, input.name),
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
    // Photos are returned straight from Text Search; the narrow id+photos mask keeps
    // this lookup in the cheap Pro tier instead of "Enterprise + Atmosphere".
    const place = await searchGooglePlace(input, GOOGLE_PLACE_PHOTO_FIELDS);
    if (!place) {
      logGooglePlacePhotoDebug("search_no_match", input);
      return null;
    }

    logGooglePlacePhotoDebug("search_match", {
      ...input,
      hasPlaceId: typeof place.id === "string",
      hasPhotos: Array.isArray(place.photos) && place.photos.length > 0,
    });
    const photo = normalizePhoto(place, input.name, {
      kind: "provider",
      label: "Google Places",
      confidence: "medium",
    });
    if (!photo) {
      logGooglePlacePhotoDebug("search_no_photo", {
        ...input,
        hasPhotos: Array.isArray(place.photos) && place.photos.length > 0,
      });
      return null;
    }

    const photos = Array.isArray(place.photos) ? place.photos.filter(isRecord) : [];
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
      providerPlaceId: typeof place.id === "string" ? place.id : undefined,
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

export async function fetchMapillaryPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
}): Promise<MapillaryPlacePhotoResult | null> {
  if (!env.MAPILLARY_ACCESS_TOKEN) {
    logMapillaryPlacePhotoDebug("not_configured", input);
    return null;
  }

  try {
    logMapillaryPlacePhotoDebug("search_start", input);
    // Start tight and widen only on an empty box: dense areas (which would 500 on a wide bbox)
    // resolve at the smallest radius, sparse areas escalate to the next.
    for (const radiusMeters of MAPILLARY_SEARCH_RADII_METERS) {
      const bbox = computeMapillaryBoundingBox(input.lat, input.long, radiusMeters);

      const url = new URL(MAPILLARY_IMAGES_API_URL);
      url.searchParams.set("fields", "id,geometry,captured_at,thumb_1024_url,creator,is_pano");
      url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
      url.searchParams.set("limit", "50");

      const response = await fetch(url, {
        headers: {
          // Header auth (not the `access_token` query param) keeps the token out of the URL
          // and out of any upstream request logs — Mapillary recommends this for entity calls.
          Authorization: `OAuth ${env.MAPILLARY_ACCESS_TOKEN}`,
        },
      });
      if (!response.ok) {
        // A 500 here is Mapillary's "too many captures in the bbox" guard; a wider radius would
        // only make it worse, so stop instead of escalating.
        logMapillaryPlacePhotoDebug("search_http_error", {
          ...input,
          radiusMeters,
          status: response.status,
        });
        return null;
      }

      const payload = await response.json();
      const match = selectClosestMapillaryImage(payload, input);
      if (!match) {
        logMapillaryPlacePhotoDebug("search_no_image", { ...input, radiusMeters });
        continue;
      }

      logMapillaryPlacePhotoDebug("photo_hit", {
        name: input.name,
        radiusMeters,
        distanceMeters: Math.round(match.distanceMeters),
        matchConfidence: match.matchConfidence,
      });

      return {
        url: match.thumbUrl,
        alt: `Street-level photo near ${input.name} (Mapillary)`,
        attribution: match.attribution,
        providerPlaceId: match.id,
        providerPhotoReference: match.id,
        matchConfidence: match.matchConfidence,
      };
    }

    return null;
  }
  catch (error) {
    logMapillaryPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function fetchWikidataPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
}): Promise<WikidataPlacePhotoResult | null> {
  try {
    logWikidataPlacePhotoDebug("search_start", input);
    const radiusKm = (Math.min(Math.max(input.radiusMeters ?? 250, 50), 1000) / 1000).toFixed(3);
    const query = buildWikidataAroundQuery(input.lat, input.long, radiusKm);

    const url = new URL(WIKIDATA_SPARQL_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("query", query);

    const response = await fetchWithTimeout(url, {
      headers: {
        // WDQS rejects requests without a descriptive User-Agent.
        "User-Agent": "WanderLog/1.0 real-place-photo-fallback",
        "Accept": "application/sparql-results+json",
      },
    }, WIKIDATA_QUERY_TIMEOUT_MS);
    if (!response.ok) {
      logWikidataPlacePhotoDebug("search_http_error", { ...input, status: response.status });
      return null;
    }

    const payload = await response.json();
    const entity = selectBestWikidataEntity(payload, input);
    if (!entity) {
      logWikidataPlacePhotoDebug("search_no_entity", input);
      return null;
    }

    logWikidataPlacePhotoDebug("photo_hit", {
      name: input.name,
      label: entity.label,
      qid: entity.qid,
      distanceMeters: entity.distanceMeters,
      matchConfidence: entity.matchConfidence,
    });

    return {
      url: entity.url,
      alt: `Фото места: ${entity.label || input.name}`,
      attribution: `Wikidata: ${entity.label}`,
      providerPlaceId: entity.qid,
      providerPhotoReference: entity.fileReference,
      matchConfidence: entity.matchConfidence,
    };
  }
  catch (error) {
    logWikidataPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function fetchTripAdvisorPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
}): Promise<TripAdvisorPlacePhotoResult | null> {
  if (!env.TRIPADVISOR_API_KEY) {
    logTripAdvisorPlacePhotoDebug("not_configured", input);
    return null;
  }

  try {
    logTripAdvisorPlacePhotoDebug("search_start", input);
    // Billing guard: once the day/month cap is hit, skip TripAdvisor entirely (including the free
    // search) so the paid photos endpoint is never reached. Fails closed if the counter is down.
    if (await isTripAdvisorQuotaExceeded()) {
      logTripAdvisorPlacePhotoDebug("quota_exceeded", input);
      return null;
    }

    const location = await searchTripAdvisorLocation(input);
    if (!location) {
      logTripAdvisorPlacePhotoDebug("search_no_location", input);
      return null;
    }

    // Reserve a billable slot before the (paid) photos call so concurrent lookups can't overshoot
    // the cap, and TripAdvisor bills per request regardless of whether it returns a photo.
    await recordTripAdvisorCall();
    const photo = await fetchTripAdvisorLocationPhoto(location.id);
    if (!photo) {
      logTripAdvisorPlacePhotoDebug("location_no_photo", { ...input, locationId: location.id, name: location.name });
      return null;
    }

    logTripAdvisorPlacePhotoDebug("photo_hit", {
      name: input.name,
      locationId: location.id,
      matchConfidence: location.matchConfidence,
    });

    return {
      url: photo.url,
      alt: `Фото места: ${location.name || input.name}`,
      attribution: photo.attribution,
      providerPlaceId: location.id,
      providerPhotoReference: photo.reference,
      matchConfidence: location.matchConfidence,
      gallery: photo.gallery,
    };
  }
  catch (error) {
    logTripAdvisorPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function fetchTripAdvisorPlaceReviews(input: {
  name: string;
  lat: number;
  long: number;
}): Promise<PlaceReviewSnippet[]> {
  if (!env.TRIPADVISOR_API_KEY) {
    logTripAdvisorPlacePhotoDebug("reviews_not_configured", input);
    return [];
  }

  try {
    // Reviews are a billable TripAdvisor endpoint (same as photos), so they share the quota.
    if (await isTripAdvisorQuotaExceeded()) {
      logTripAdvisorPlacePhotoDebug("reviews_quota_exceeded", input);
      return [];
    }

    const location = await searchTripAdvisorLocation(input);
    if (!location)
      return [];

    await recordTripAdvisorCall();
    const reviews = await fetchTripAdvisorLocationReviews(location.id);
    logTripAdvisorPlacePhotoDebug("reviews_hit", { name: input.name, locationId: location.id, count: reviews.length });
    return reviews;
  }
  catch (error) {
    logTripAdvisorPlacePhotoDebug("reviews_unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

export async function fetchFlickrPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
}): Promise<FlickrPlacePhotoResult | null> {
  if (!env.FLICKR_API_KEY) {
    logFlickrPlacePhotoDebug("not_configured", input);
    return null;
  }

  try {
    logFlickrPlacePhotoDebug("search_start", input);
    const radiusKm = Math.min(Math.max((input.radiusMeters ?? 250) / 1000, 0.1), FLICKR_MAX_RADIUS_KM);

    const url = new URL(FLICKR_API_URL);
    url.searchParams.set("method", "flickr.photos.search");
    url.searchParams.set("api_key", env.FLICKR_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("nojsoncallback", "1");
    // Name as `text` doubles as the geo "limiting agent" and keeps hits relevant to the place.
    url.searchParams.set("text", input.name);
    url.searchParams.set("lat", String(input.lat));
    url.searchParams.set("lon", String(input.long));
    url.searchParams.set("radius", radiusKm.toFixed(3));
    url.searchParams.set("radius_units", "km");
    url.searchParams.set("media", "photos");
    url.searchParams.set("content_type", "1");
    url.searchParams.set("safe_search", "1");
    url.searchParams.set("license", FLICKR_REUSABLE_LICENSES);
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("per_page", "20");
    url.searchParams.set("extras", "url_l,url_c,url_m,owner_name,tags,views");

    const response = await fetchWithTimeout(url, {}, FLICKR_QUERY_TIMEOUT_MS);
    if (!response.ok) {
      logFlickrPlacePhotoDebug("search_http_error", { ...input, status: response.status });
      return null;
    }

    const payload = await response.json();
    if (!isRecord(payload) || payload.stat !== "ok" || !isRecord(payload.photos)) {
      logFlickrPlacePhotoDebug("api_error", {
        ...input,
        stat: isRecord(payload) ? payload.stat : "unknown",
      });
      return null;
    }

    const photos = Array.isArray(payload.photos.photo) ? payload.photos.photo.filter(isRecord) : [];
    const best = selectBestFlickrPhoto(photos, input);
    if (!best) {
      logFlickrPlacePhotoDebug("search_no_photo", input);
      return null;
    }

    logFlickrPlacePhotoDebug("photo_hit", {
      name: input.name,
      photoId: best.id,
      matchConfidence: best.matchConfidence,
    });

    return {
      url: best.url,
      alt: `Фото места: ${input.name}`,
      attribution: best.attribution,
      providerPlaceId: best.owner || best.id,
      providerPhotoReference: best.id,
      matchConfidence: best.matchConfidence,
    };
  }
  catch (error) {
    logFlickrPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function fetchWikimapiaPlacePhoto(input: {
  name: string;
  lat: number;
  long: number;
  radiusMeters?: number;
}): Promise<WikimapiaPlacePhotoResult | null> {
  if (!env.WIKIMAPIA_API_KEY) {
    logWikimapiaPlacePhotoDebug("not_configured", input);
    return null;
  }

  try {
    logWikimapiaPlacePhotoDebug("search_start", input);
    const maxDistanceMeters = Math.min(input.radiusMeters ?? 250, WIKIMAPIA_MAX_DISTANCE_METERS);
    const place = await findNearestWikimapiaPlace(input, maxDistanceMeters);
    if (!place) {
      logWikimapiaPlacePhotoDebug("search_no_place", input);
      return null;
    }

    const photo = await fetchWikimapiaPhotoByPlaceId(place.id);
    if (!photo) {
      logWikimapiaPlacePhotoDebug("place_no_photo", { ...input, placeId: place.id, title: place.title });
      return null;
    }

    logWikimapiaPlacePhotoDebug("photo_hit", {
      name: input.name,
      title: place.title,
      distanceMeters: place.distance,
      matchConfidence: place.matchConfidence,
    });

    return {
      url: photo.url,
      alt: `Фото места: ${place.title || input.name}`,
      attribution: photo.attribution,
      providerPlaceId: String(place.id),
      providerPhotoReference: photo.reference,
      matchConfidence: place.matchConfidence,
    };
  }
  catch (error) {
    logWikimapiaPlacePhotoDebug("unavailable", {
      ...input,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

async function searchGooglePlace(
  input: { name: string; lat: number; long: number },
  fieldMask: string = GOOGLE_PLACE_FIELDS,
) {
  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY || "",
      "X-Goog-FieldMask": fieldMask,
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

async function search2GisPlace(input: { name: string; lat: number; long: number }) {
  const url = new URL(TWOGIS_BASE_URL);
  url.searchParams.set("q", input.name);
  // 2GIS expects "lon,lat" order for the location bias point.
  url.searchParams.set("location", `${input.long},${input.lat}`);
  url.searchParams.set("fields", TWOGIS_FIELDS);
  url.searchParams.set("locale", TWOGIS_LOCALE);
  url.searchParams.set("page_size", "1");
  url.searchParams.set("key", env.TWOGIS_API_KEY || "");

  const response = await fetch(url);
  if (!response.ok) {
    log2GisDebug("search_http_error", {
      ...input,
      status: response.status,
    });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload))
    return null;

  const result = isRecord(payload.result) ? payload.result : null;
  const items = result && Array.isArray(result.items) ? result.items.filter(isRecord) : [];
  return items[0] ?? null;
}

function parse2GisBranchId(id: unknown): string {
  // The Catalog item id (e.g. "4504128908502749") is the reviews branch id; strip any
  // "_suffix" defensively.
  if (typeof id === "string" && id.trim())
    return id.split("_")[0];
  if (typeof id === "number" && Number.isFinite(id))
    return String(id);
  return "";
}

export function normalize2GisPlace(item: Record<string, unknown>): PlaceProviderData {
  const source = {
    kind: "provider" as const,
    label: "2ГИС",
    confidence: "medium" as const,
  };

  return {
    rating: normalize2GisRating(item, source),
  };
}

function normalize2GisRating(
  item: Record<string, unknown>,
  source: PlaceRating["source"],
): PlaceRating | null {
  const reviews = isRecord(item.reviews) ? item.reviews : null;
  if (!reviews)
    return null;

  const value = parseNumeric(reviews.general_rating ?? reviews.rating ?? reviews.org_rating);
  if (value === null || value <= 0)
    return null;

  const reviewCount = parseNumeric(reviews.review_count ?? reviews.org_review_count);

  return {
    value: Math.min(Math.max(value, 0), 5),
    scale: 5,
    reviewCount: reviewCount !== null && reviewCount >= 0 ? Math.round(reviewCount) : undefined,
    source,
  };
}

export async function fetch2GisBranchReviews(branchId: string): Promise<PlaceReviewSnippet[]> {
  const source: PlaceReviewSnippet["source"] = {
    kind: "provider",
    label: "2ГИС",
    confidence: "medium",
  };

  try {
    const url = new URL(`${TWOGIS_REVIEWS_BASE_URL}/${encodeURIComponent(branchId)}/reviews`);
    url.searchParams.set("limit", "20");
    url.searchParams.set("rated", "true");
    url.searchParams.set("sort_by", "date_edited");
    url.searchParams.set("fields", "meta.branch_rating,meta.branch_reviews_count,reviews.hiding_reason");
    url.searchParams.set("locale", TWOGIS_LOCALE);
    url.searchParams.set("key", env.TWOGIS_REVIEWS_API_KEY || TWOGIS_REVIEWS_PUBLIC_KEY);

    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": TWOGIS_REVIEWS_USER_AGENT },
    }, TWOGIS_REVIEWS_TIMEOUT_MS);
    if (!response.ok) {
      log2GisReviewsDebug("http_error", { branchId, status: response.status });
      return [];
    }

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.reviews))
      return [];

    const snippets = payload.reviews
      .filter(isRecord)
      // Skip reviews 2GIS itself hides or holds for moderation.
      .filter(review => review.is_hidden !== true && review.on_moderation !== true)
      .map((review): PlaceReviewSnippet | null => {
        const text = typeof review.text === "string" ? review.text.trim() : "";
        if (!text)
          return null;

        const user = isRecord(review.user) ? review.user : {};
        const rating = parseNumeric(review.rating);
        const date = typeof review.date_created === "string" ? review.date_created.slice(0, 10) : undefined;

        return {
          authorLabel: typeof user.name === "string" && user.name.trim() ? user.name.trim() : undefined,
          text: text.length > 500 ? `${text.slice(0, 497).trimEnd()}…` : text,
          relativeTime: date,
          rating: rating !== null ? Math.min(Math.max(rating, 0), 5) : undefined,
          source,
        };
      })
      .filter((review): review is PlaceReviewSnippet => review !== null)
      .slice(0, TWOGIS_REVIEWS_MAX);

    log2GisReviewsDebug("reviews_hit", { branchId, count: snippets.length });
    return snippets;
  }
  catch (error) {
    log2GisReviewsDebug("unavailable", {
      branchId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
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

function computeMapillaryBoundingBox(lat: number, long: number, radiusMeters: number) {
  const latDelta = Math.min(radiusMeters / 111_320, MAPILLARY_MAX_HALF_SPAN_DEG);
  // Guard against the cos(lat) → 0 singularity at the poles before dividing by it.
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const lonDelta = Math.min(radiusMeters / (111_320 * cosLat), MAPILLARY_MAX_HALF_SPAN_DEG);

  return {
    west: long - lonDelta,
    south: lat - latDelta,
    east: long + lonDelta,
    north: lat + latDelta,
  };
}

function selectClosestMapillaryImage(
  payload: unknown,
  input: { name: string; lat: number; long: number },
) {
  if (!isRecord(payload) || !Array.isArray(payload.data))
    return null;

  const candidates = payload.data
    .filter(isRecord)
    .map((image) => {
      const geometry = isRecord(image.geometry) ? image.geometry : {};
      const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
      // GeoJSON order is [longitude, latitude], not [lat, long].
      const lon = parseNumeric(coordinates[0]);
      const lat = parseNumeric(coordinates[1]);
      const thumbUrl = typeof image.thumb_1024_url === "string" ? image.thumb_1024_url : "";
      const id = typeof image.id === "string" ? image.id : "";
      if (lat === null || lon === null || !thumbUrl || !id)
        return null;

      return {
        id,
        thumbUrl,
        attribution: buildMapillaryAttribution(image.creator),
        isPano: image.is_pano === true,
        distanceMeters: haversineMeters(input.lat, input.long, lat, lon),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    // Prefer flat frames over 360° panoramas (their equirectangular thumbnails look
    // distorted as a place photo), then the closest capture to the requested point.
    .sort((a, b) => Number(a.isPano) - Number(b.isPano) || a.distanceMeters - b.distanceMeters);

  const closest = candidates[0];
  if (!closest)
    return null;

  return {
    ...closest,
    matchConfidence: closest.distanceMeters <= MAPILLARY_MEDIUM_CONFIDENCE_METERS
      ? "medium" as const
      : "low" as const,
  };
}

function buildMapillaryAttribution(creator: unknown) {
  const username = isRecord(creator) && typeof creator.username === "string" ? creator.username : "";
  return username ? `Mapillary: ${username}` : "Mapillary";
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
}

function logMapillaryPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[mapillary-place-photo]", stage, details);
}

function buildWikidataAroundQuery(lat: number, long: number, radiusKm: string) {
  // Nearby items that carry a curated image (P18), with a ru/en label and the distance to the
  // query point. P625 = coordinate location; the around service does the geospatial filtering.
  return `SELECT ?item ?itemLabel ?image ?dist WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:center "Point(${long} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
    bd:serviceParam wikibase:distance ?dist .
  }
  ?item wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en" . }
} ORDER BY ?dist LIMIT 20`;
}

function selectBestWikidataEntity(payload: unknown, input: { name: string }) {
  if (!isRecord(payload) || !isRecord(payload.results) || !Array.isArray(payload.results.bindings))
    return null;

  const candidates = payload.results.bindings
    .filter(isRecord)
    .map((row) => {
      const label = isRecord(row.itemLabel) && typeof row.itemLabel.value === "string" ? row.itemLabel.value : "";
      const itemUri = isRecord(row.item) && typeof row.item.value === "string" ? row.item.value : "";
      const qid = itemUri.split("/").pop() ?? "";
      const image = isRecord(row.image) && typeof row.image.value === "string" ? row.image.value : "";
      const distKm = isRecord(row.dist) ? parseNumeric(row.dist.value) : null;
      if (!label || !qid || !image)
        return null;

      return {
        label,
        qid,
        image,
        distanceMeters: Math.round((distKm ?? 0) * 1000),
        nameScore: scoreWikimediaMatch(input.name, label),
      };
    })
    // Require a real name match: the around service returns every nearby entity with an image,
    // so without this a "Красная площадь" query could pick a neighbouring monument's photo. A
    // wrong landmark is worse than none, so unmatched places fall through to the next provider.
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      candidate !== null && candidate.nameScore !== "low");

  if (!candidates.length)
    return null;

  const scoreRank = { high: 3, medium: 2, low: 1 } as const;
  candidates.sort((a, b) => scoreRank[b.nameScore] - scoreRank[a.nameScore] || a.distanceMeters - b.distanceMeters);

  const best = candidates[0];
  return {
    label: best.label,
    qid: best.qid,
    distanceMeters: best.distanceMeters,
    matchConfidence: best.nameScore,
    url: buildWikidataCommonsThumbUrl(best.image),
    fileReference: decodeWikidataFileName(best.image),
  };
}

function buildWikidataCommonsThumbUrl(image: string) {
  // P18 arrives as a Commons Special:FilePath URL; upgrade to https and request a sized thumbnail
  // (FilePath honours ?width=N) so we don't ship a multi-megabyte original to the client.
  const https = image.replace(/^http:\/\//i, "https://");
  return `${https}${https.includes("?") ? "&" : "?"}width=1024`;
}

function decodeWikidataFileName(image: string) {
  const last = image.split("/").pop() ?? image;
  try {
    return decodeURIComponent(last);
  }
  catch {
    return last;
  }
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  }
  finally {
    clearTimeout(timer);
  }
}

function logWikidataPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[wikidata-place-photo]", stage, details);
}

function selectBestFlickrPhoto(
  photos: Record<string, unknown>[],
  input: { name: string },
) {
  // Flickr already returns these relevance-sorted, so take the first with a usable rendition.
  for (const photo of photos) {
    const url = pickFlickrPhotoUrl(photo);
    if (!url)
      continue;

    const id = typeof photo.id === "string" ? photo.id : "";
    if (!id)
      continue;

    const title = typeof photo.title === "string" ? photo.title : "";
    const tags = typeof photo.tags === "string" ? photo.tags : "";
    const ownerName = typeof photo.ownername === "string" ? photo.ownername : "";

    return {
      id,
      url,
      owner: typeof photo.owner === "string" ? photo.owner : "",
      attribution: ownerName ? `Flickr: ${ownerName}` : "Flickr",
      // Honest relevance badge: Flickr's text engine gated the search, but title/tag overlap with
      // the place name tells us how confidently the photo actually depicts it.
      matchConfidence: scoreWikimediaMatch(input.name, `${title} ${tags}`),
    };
  }

  return null;
}

function pickFlickrPhotoUrl(photo: Record<string, unknown>): string {
  // Prefer large (1024) → medium-large (800) → medium (500). Flickr already returns https URLs.
  for (const key of ["url_l", "url_c", "url_m"]) {
    const value = photo[key];
    if (typeof value === "string" && value)
      return value;
  }

  return "";
}

function logFlickrPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[flickr-place-photo]", stage, details);
}

async function searchTripAdvisorLocation(input: { name: string; lat: number; long: number }) {
  const url = new URL(`${TRIPADVISOR_API_URL}/location/search`);
  url.searchParams.set("key", env.TRIPADVISOR_API_KEY || "");
  url.searchParams.set("searchQuery", input.name);
  url.searchParams.set("latLong", `${input.lat},${input.long}`);
  url.searchParams.set("language", TRIPADVISOR_LANGUAGE);

  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  }, TRIPADVISOR_QUERY_TIMEOUT_MS);
  if (!response.ok) {
    logTripAdvisorPlacePhotoDebug("search_http_error", { ...input, status: response.status });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data))
    return null;

  const candidates = payload.data
    .filter(isRecord)
    .map((item) => {
      const id = normalizeTripAdvisorId(item.location_id);
      const name = typeof item.name === "string" ? item.name : "";
      if (!id || !name)
        return null;

      return { id, name, nameScore: scoreWikimediaMatch(input.name, name) };
    })
    // Require a real name match so we photograph the venue the user asked for, not a neighbour.
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      candidate !== null && candidate.nameScore !== "low");

  if (!candidates.length)
    return null;

  const scoreRank = { high: 3, medium: 2, low: 1 } as const;
  candidates.sort((a, b) => scoreRank[b.nameScore] - scoreRank[a.nameScore]);

  const best = candidates[0];
  return { ...best, matchConfidence: best.nameScore };
}

async function fetchTripAdvisorLocationPhoto(locationId: string) {
  const url = new URL(`${TRIPADVISOR_API_URL}/location/${encodeURIComponent(locationId)}/photos`);
  url.searchParams.set("key", env.TRIPADVISOR_API_KEY || "");
  url.searchParams.set("language", TRIPADVISOR_LANGUAGE);

  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  }, TRIPADVISOR_QUERY_TIMEOUT_MS);
  if (!response.ok) {
    logTripAdvisorPlacePhotoDebug("photos_http_error", { locationId, status: response.status });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data))
    return null;

  // One photos call returns up to 5 images — collect them all (hero = first usable) so the
  // carousel reuses this single billable call instead of paying again.
  const gallery: string[] = [];
  let hero: { url: string; attribution: string; reference: string } | null = null;
  for (const photo of payload.data.filter(isRecord)) {
    const source = pickTripAdvisorPhotoUrl(photo);
    if (!source)
      continue;

    gallery.push(source);
    if (!hero) {
      hero = {
        url: source,
        attribution: buildTripAdvisorAttribution(photo),
        reference: normalizeTripAdvisorId(photo.id) || locationId,
      };
    }
    if (gallery.length >= 5)
      break;
  }

  return hero ? { ...hero, gallery } : null;
}

async function fetchTripAdvisorLocationReviews(locationId: string): Promise<PlaceReviewSnippet[]> {
  const url = new URL(`${TRIPADVISOR_API_URL}/location/${encodeURIComponent(locationId)}/reviews`);
  url.searchParams.set("key", env.TRIPADVISOR_API_KEY || "");
  url.searchParams.set("language", TRIPADVISOR_LANGUAGE);

  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  }, TRIPADVISOR_QUERY_TIMEOUT_MS);
  if (!response.ok) {
    logTripAdvisorPlacePhotoDebug("reviews_http_error", { locationId, status: response.status });
    return [];
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data))
    return [];

  const source: PlaceReviewSnippet["source"] = {
    kind: "provider",
    label: "TripAdvisor",
    confidence: "medium",
  };

  return payload.data
    .filter(isRecord)
    .slice(0, 3)
    .map((review): PlaceReviewSnippet | null => {
      const text = typeof review.text === "string" ? review.text.trim() : "";
      if (!text)
        return null;

      const user = isRecord(review.user) ? review.user : {};
      const rating = parseNumeric(review.rating);
      const published = typeof review.published_date === "string" ? review.published_date.slice(0, 10) : undefined;

      return {
        authorLabel: typeof user.username === "string" ? user.username : undefined,
        text: text.length > 500 ? `${text.slice(0, 497).trimEnd()}…` : text,
        relativeTime: published,
        rating: rating !== null ? Math.min(Math.max(rating, 0), 5) : undefined,
        source,
      };
    })
    .filter((review): review is PlaceReviewSnippet => review !== null);
}

function pickTripAdvisorPhotoUrl(photo: Record<string, unknown>): string {
  const images = isRecord(photo.images) ? photo.images : {};
  // large is a sensible card size; fall back to the original or medium rendition.
  for (const key of ["large", "original", "medium"]) {
    const size = isRecord(images[key]) ? images[key] : null;
    const url = size && typeof size.url === "string" ? size.url : "";
    if (url)
      return url;
  }

  return "";
}

function buildTripAdvisorAttribution(photo: Record<string, unknown>): string {
  const user = isRecord(photo.user) && typeof photo.user.username === "string" ? photo.user.username : "";
  return user ? `TripAdvisor: ${user}` : "TripAdvisor";
}

function normalizeTripAdvisorId(value: unknown): string {
  if (typeof value === "string")
    return value.trim();

  if (typeof value === "number" && Number.isFinite(value))
    return String(value);

  return "";
}

function logTripAdvisorPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[tripadvisor-place-photo]", stage, details);
}

async function findNearestWikimapiaPlace(
  input: { name: string; lat: number; long: number },
  maxDistanceMeters: number,
) {
  const url = new URL(WIKIMAPIA_API_URL);
  url.searchParams.set("function", "place.getnearest");
  url.searchParams.set("lat", String(input.lat));
  url.searchParams.set("lon", String(input.long));
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "ru");
  url.searchParams.set("count", "20");
  url.searchParams.set("data_blocks", "location");
  url.searchParams.set("key", env.WIKIMAPIA_API_KEY || "");

  const response = await fetch(url);
  if (!response.ok) {
    logWikimapiaPlacePhotoDebug("getnearest_http_error", { ...input, status: response.status });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.places))
    return null;

  const candidates = payload.places
    .filter(isRecord)
    .map((place) => {
      const id = parseNumeric(place.id);
      const title = typeof place.title === "string" ? place.title : "";
      const distance = parseNumeric(place.distance);
      if (id === null || !title || distance === null)
        return null;

      return {
        id,
        title,
        distance: Math.round(distance),
        nameScore: scoreWikimediaMatch(input.name, title),
      };
    })
    // Require an actual name match within range. getnearest is sorted by distance, so without
    // this it returns whatever tiny object sits closest to the point — e.g. a "Мозаичный вазон"
    // or a "Пушка" inside Парк Горького / the Kremlin — instead of the landmark itself. A wrong
    // photo is worse than none, so a place we can't name-match falls through to the next provider.
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      candidate !== null && candidate.distance <= maxDistanceMeters && candidate.nameScore !== "low");

  if (!candidates.length)
    return null;

  const scoreRank = { high: 3, medium: 2, low: 1 } as const;
  candidates.sort((a, b) => scoreRank[b.nameScore] - scoreRank[a.nameScore] || a.distance - b.distance);

  const best = candidates[0];
  return { ...best, matchConfidence: best.nameScore };
}

async function fetchWikimapiaPhotoByPlaceId(id: number) {
  const url = new URL(WIKIMAPIA_API_URL);
  url.searchParams.set("function", "place.getbyid");
  url.searchParams.set("id", String(id));
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "ru");
  url.searchParams.set("data_blocks", "main,photos");
  url.searchParams.set("key", env.WIKIMAPIA_API_KEY || "");

  const response = await fetch(url);
  if (!response.ok) {
    logWikimapiaPlacePhotoDebug("getbyid_http_error", { id, status: response.status });
    return null;
  }

  const payload = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.photos))
    return null;

  const photos = payload.photos.filter(isRecord);
  if (!photos.length)
    return null;

  // Prefer the most recent capture; Wikimapia data skews old, so the newest photo is usually the
  // most representative.
  photos.sort((a, b) => (parseNumeric(b.time) ?? 0) - (parseNumeric(a.time) ?? 0));

  for (const photo of photos) {
    const source = pickWikimapiaPhotoUrl(photo);
    if (!source)
      continue;

    const reference = parseNumeric(photo.id);
    return {
      url: source,
      attribution: buildWikimapiaAttribution(photo),
      reference: reference !== null ? String(reference) : source,
    };
  }

  return null;
}

function pickWikimapiaPhotoUrl(photo: Record<string, unknown>): string {
  const renditions = [photo["960_url"], photo["1280_url"], photo.big_url, photo.thumbnailRetina_url, photo.thumbnail_url];
  for (const rendition of renditions) {
    // Wikimapia serves photo URLs over http; upgrade to https to avoid mixed-content blocking
    // when the browser loads them from our https origin.
    if (typeof rendition === "string" && rendition)
      return rendition.replace(/^http:\/\//i, "https://");
  }

  return "";
}

function buildWikimapiaAttribution(photo: Record<string, unknown>): string {
  const user = typeof photo.user_name === "string" ? photo.user_name : "";
  return user ? `Wikimapia: ${user}` : "Wikimapia";
}

function logWikimapiaPlacePhotoDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[wikimapia-place-photo]", stage, details);
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

function log2GisDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[2gis-place]", stage, details);
}

function log2GisReviewsDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[2gis-reviews]", stage, details);
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}
