import type {
  ExploreCandidatePlace,
  ExploreCurrentLocationContext,
  ExploreInterest,
  ExplorePlaceFilters,
  ExploreRequestContext,
} from "~/lib/explore/context";
import type { SelectedExploreCity } from "~/lib/explore/search";

import { DEFAULT_EXPLORE_FILTERS } from "~/lib/explore/context";

const selectedCity = ref<SelectedExploreCity | null>(null);
const selectedDays = ref(3);
const selectedInterests = ref<ExploreInterest[]>(["culture", "food"]);
const filters = ref<ExplorePlaceFilters>({ ...DEFAULT_EXPLORE_FILTERS });
const currentLocation = ref<ExploreCurrentLocationContext>({ enabled: false });
const selectedSavedPlaceIds = ref<number[]>([]);
const selectedDiaryLogIds = ref<number[]>([]);
const candidatePlaces = ref<ExploreCandidatePlace[]>([]);

const requestContext = computed<ExploreRequestContext>(() => ({
  city: selectedCity.value,
  selectedDays: selectedDays.value,
  interests: selectedInterests.value,
  filters: filters.value,
  currentLocation: currentLocation.value,
  selectedSavedPlaceIds: selectedSavedPlaceIds.value,
  selectedDiaryLogIds: selectedDiaryLogIds.value,
  candidatePlaces: candidatePlaces.value.filter(place => place.selected),
}));

function toggleInterest(interest: ExploreInterest) {
  selectedInterests.value = selectedInterests.value.includes(interest)
    ? selectedInterests.value.filter(value => value !== interest)
    : [...selectedInterests.value, interest];
}

function setSelectedCity(city: SelectedExploreCity | null) {
  selectedCity.value = city;
}

function setCurrentLocation(nextLocation: ExploreCurrentLocationContext) {
  currentLocation.value = nextLocation;
}

function toggleSavedPlace(placeId: number) {
  selectedSavedPlaceIds.value = toggleNumber(selectedSavedPlaceIds.value, placeId);
}

function toggleDiaryLog(logId: number) {
  selectedDiaryLogIds.value = toggleNumber(selectedDiaryLogIds.value, logId);
}

function setCandidatePlaces(places: ExploreCandidatePlace[]) {
  const selectedIds = new Set(candidatePlaces.value.filter(place => place.selected).map(place => place.id));
  candidatePlaces.value = places.map(place => ({
    ...place,
    selected: selectedIds.has(place.id) || place.selected,
  }));
}

function toggleCandidatePlace(placeId: string) {
  candidatePlaces.value = candidatePlaces.value.map(place => place.id === placeId
    ? { ...place, selected: !place.selected }
    : place);
}

function resetExploreContext() {
  selectedCity.value = null;
  selectedDays.value = 3;
  selectedInterests.value = ["culture", "food"];
  filters.value = { ...DEFAULT_EXPLORE_FILTERS };
  currentLocation.value = { enabled: false };
  selectedSavedPlaceIds.value = [];
  selectedDiaryLogIds.value = [];
  candidatePlaces.value = [];
}

function toggleNumber(values: number[], value: number) {
  return values.includes(value)
    ? values.filter(entry => entry !== value)
    : [...values, value];
}

export function useExploreContext() {
  return {
    selectedCity,
    selectedDays,
    selectedInterests,
    filters,
    currentLocation,
    selectedSavedPlaceIds,
    selectedDiaryLogIds,
    candidatePlaces,
    requestContext,
    setSelectedCity,
    setCurrentLocation,
    toggleInterest,
    toggleSavedPlace,
    toggleDiaryLog,
    setCandidatePlaces,
    toggleCandidatePlace,
    resetExploreContext,
  };
}
