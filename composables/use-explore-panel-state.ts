import { computed, reactive } from "vue";

// Module-level registry of open mobile overlay panels whose bottom sheets share
// the lower-screen band with the route-step carousel (the open-in-maps export
// menu and the results-actions popovers). When one is open the carousel hides so
// the two surfaces don't collide at the bottom of the screen. Mirrors the
// module-level singleton pattern of useRouteEditMode / useUserRoutePoints.
//
// Add-mode (manual points) and edit-mode already expose their own shared flags,
// so the carousel reads those directly and they are not duplicated here.
const openPanels = reactive<Record<string, boolean>>({});

function setPanelOpen(key: string, open: boolean) {
  if (open)
    openPanels[key] = true;
  else
    delete openPanels[key];
}

const anyPanelOpen = computed(() => Object.keys(openPanels).length > 0);

export function useExplorePanelState() {
  return { anyPanelOpen, setPanelOpen };
}
