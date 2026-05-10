import type { ExploreCandidatePlace, ExploreRequestContext } from "~/lib/explore/context";

import { findExploreContextByUserId } from "~/lib/db/queries/explore-context";

const MAX_SELECTED_SAVED_PLACES = 10;
const MAX_SELECTED_DIARY_LOGS = 10;
const MAX_SELECTED_CANDIDATE_PLACES = 12;
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
  };
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
