// Module-level state so the toggle control, the map page, and the marker drag
// handler all share one edit-mode flag — mirrors useUserRoutePoints' add-mode.
const isEditMode = ref(false);

function setEditMode(enabled: boolean) {
  isEditMode.value = enabled;
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value;
}

export function useRouteEditMode() {
  return {
    isEditMode,
    setEditMode,
    toggleEditMode,
  };
}
