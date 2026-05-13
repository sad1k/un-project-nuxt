import type { ExploreCoordinates, SelectedExploreCity } from "./search";

export type ExploreInterest
  = | "culture"
    | "food"
    | "nature"
    | "adventure"
    | "art"
    | "nightlife"
    | "shopping"
    | "family"
    | "hidden-gems";

export type ExplorePlaceFilters = {
  query: string;
  interests: ExploreInterest[];
  includeSavedPlaces: boolean;
  includeCandidatePlaces: boolean;
};

export type ExploreCandidatePlace = {
  id: string;
  provider?: string;
  providerId?: string;
  name: string;
  description?: string;
  coordinates?: ExploreCoordinates;
  categories: ExploreInterest[];
  source: "provider" | "saved" | "diary" | "fallback";
  selected: boolean;
};

export type ExploreCurrentLocationContext = {
  enabled: boolean;
  coordinates?: ExploreCoordinates;
};

export type ExploreSavedPlaceContext = {
  id: number;
  name: string;
  description: string | null;
  coordinates: ExploreCoordinates;
  logCount: number;
};

export type ExploreDiaryLogContext = {
  id: number;
  locationId: number;
  name: string;
  description: string | null;
  coordinates: ExploreCoordinates;
  startedAt: number;
  endedAt: number;
};

export type ExplorePersonalContext = {
  savedPlaces: ExploreSavedPlaceContext[];
  diaryLogs: ExploreDiaryLogContext[];
};

export type ExploreRequestContext = {
  city: SelectedExploreCity | null;
  selectedDays: number;
  interests: ExploreInterest[];
  filters: ExplorePlaceFilters;
  currentLocation: ExploreCurrentLocationContext;
  selectedSavedPlaceIds: number[];
  selectedDiaryLogIds: number[];
  candidatePlaces: ExploreCandidatePlace[];
};

export const DEFAULT_EXPLORE_FILTERS: ExplorePlaceFilters = {
  query: "",
  interests: [],
  includeSavedPlaces: true,
  includeCandidatePlaces: true,
};

export function createEmptyExploreRequestContext(): ExploreRequestContext {
  return {
    city: null,
    selectedDays: 3,
    interests: [],
    filters: { ...DEFAULT_EXPLORE_FILTERS },
    currentLocation: {
      enabled: false,
    },
    selectedSavedPlaceIds: [],
    selectedDiaryLogIds: [],
    candidatePlaces: [],
  };
}
