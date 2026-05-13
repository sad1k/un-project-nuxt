import { findExploreContextByUserId } from "~/lib/db/queries/explore-context";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  return findExploreContextByUserId(event.context.user.id);
});
