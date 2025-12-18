import { getUserLocationLogImages } from "~/lib/db/queries/post";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  return getUserLocationLogImages(event.context.user.id);
});
