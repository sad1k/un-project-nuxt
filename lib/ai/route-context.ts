import type { ExploreCandidatePlace, ExploreRequestContext } from "~/lib/explore/context";

import { findExploreContextByUserId } from "~/lib/db/queries/explore-context";
import { haversineDistanceMeters } from "~/lib/explore/route-map";

const MAX_SELECTED_SAVED_PLACES = 10;
const MAX_SELECTED_DIARY_LOGS = 10;
const MAX_SELECTED_CANDIDATE_PLACES = 12;
const MAX_ANCHOR_POINTS = 25;
const MAX_DESCRIPTION_LENGTH = 240;

export async function buildSelectedRouteContext(
  userId: number,
  requestContext: ExploreRequestContext,
) {
  const personalContext = await findExploreContextByUserId(userId);
  const selectedSavedPlaceIds = new Set(requestContext.selectedSavedPlaceIds);
  const selectedDiaryLogIds = new Set(requestContext.selectedDiaryLogIds);

  return {
    city: requestContext.city
      ? {
          id: requestContext.city.id,
          provider: requestContext.city.provider,
          providerId: requestContext.city.providerId,
          name: requestContext.city.name,
          coordinates: requestContext.city.coordinates,
        }
      : null,
    selectedDays: requestContext.selectedDays,
    interests: requestContext.interests,
    filters: {
      query: requestContext.filters.query,
      interests: requestContext.filters.interests,
    },
    currentLocation: requestContext.currentLocation.enabled
      ? requestContext.currentLocation
      : { enabled: false },
    savedPlaces: personalContext.savedPlaces
      .filter(place => selectedSavedPlaceIds.has(place.id))
      .slice(0, MAX_SELECTED_SAVED_PLACES)
      .map(place => ({
        id: place.id,
        name: place.name,
        description: truncateText(place.description),
        coordinates: place.coordinates,
        logCount: place.logCount,
      })),
    diaryLogs: personalContext.diaryLogs
      .filter(log => selectedDiaryLogIds.has(log.id))
      .slice(0, MAX_SELECTED_DIARY_LOGS)
      .map(log => ({
        id: log.id,
        locationId: log.locationId,
        name: log.name,
        description: truncateText(log.description),
        coordinates: log.coordinates,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
      })),
    candidatePlaces: getSelectedCandidatePlaces(requestContext.candidatePlaces),
    anchorPoints: getAnchorPoints(requestContext.anchorPoints),
    anchorRegion: getAnchorRegion(requestContext.anchorPoints),
  };
}

// Derives an explicit geographic scope (bounding box, centroid, radius) from the
// hand-dropped anchors. The model reasons poorly over a bare list of lat/long
// numbers, so without this it drifts toward the famous city centre instead of
// enriching around where the user actually placed their points.
function getAnchorRegion(anchorPoints: ExploreRequestContext["anchorPoints"]) {
  const points = (anchorPoints ?? []).slice(0, MAX_ANCHOR_POINTS);
  if (!points.length)
    return null;

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLong = Number.POSITIVE_INFINITY;
  let maxLong = Number.NEGATIVE_INFINITY;
  let latSum = 0;
  let longSum = 0;

  for (const point of points) {
    const { lat, long } = point.coordinates;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLong = Math.min(minLong, long);
    maxLong = Math.max(maxLong, long);
    latSum += lat;
    longSum += long;
  }

  const center = {
    lat: roundTo(latSum / points.length, 6),
    long: roundTo(longSum / points.length, 6),
  };

  const radiusMeters = Math.round(points.reduce((max, point) => Math.max(
    max,
    haversineDistanceMeters(
      { lat: center.lat, lng: center.long },
      { lat: point.coordinates.lat, lng: point.coordinates.long },
    ),
  ), 0));

  // Allow added stops to sit a little outside the anchor footprint so genuine
  // "on the way / nearby" places still qualify, without letting the route drift
  // across the city.
  const maxDetourMeters = Math.min(4000, Math.max(1500, Math.round(radiusMeters * 0.5)));

  return {
    bounds: {
      minLat: roundTo(minLat, 6),
      minLong: roundTo(minLong, 6),
      maxLat: roundTo(maxLat, 6),
      maxLong: roundTo(maxLong, 6),
    },
    center,
    radiusMeters,
    maxDetourMeters,
  };
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getAnchorPoints(anchorPoints: ExploreRequestContext["anchorPoints"]) {
  return (anchorPoints ?? [])
    .slice(0, MAX_ANCHOR_POINTS)
    .map(point => ({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates,
      day: point.day,
    }));
}

function getSelectedCandidatePlaces(candidatePlaces: ExploreCandidatePlace[]) {
  return candidatePlaces
    .filter(place => place.selected)
    .slice(0, MAX_SELECTED_CANDIDATE_PLACES)
    .map(place => ({
      id: place.id,
      provider: place.provider,
      providerId: place.providerId,
      name: place.name,
      description: truncateText(place.description),
      coordinates: place.coordinates,
      categories: place.categories,
      source: place.source,
    }));
}

function truncateText(value: string | null | undefined) {
  if (!value)
    return undefined;

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > MAX_DESCRIPTION_LENGTH
    ? `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1)}...`
    : normalized;
}
