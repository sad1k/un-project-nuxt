import { findLocations } from "~/lib/db/queries/location";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  return findLocations(event.context.user.id);
});
