import type { RouteLocationRaw } from "vue-router";

import type { UserWithId } from "./db/schema";

declare module "h3" {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface H3EventContext {
    user?: UserWithId;
  }
}

export type LatLongItem = {
  lat: number;
  long: number;
};

export type MapPoint = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  to?: RouteLocationRaw;
  toLabel?: string;
} & LatLongItem;

export type SearchLocation = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: string[];
};
