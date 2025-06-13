import type { MapPoint } from "~/lib/types";

export type SidebarItem = {
  label: string;
  icon: string;
  href: string;
  id: string;
  location?: MapPoint | null;
};

export const useSidebarStore = defineStore("useSidebarStore", () => {
  const sidebarItems = ref<SidebarItem[]>([]);

  const loading = ref(false);

  return {
    sidebarItems,
    loading,
  };
});
