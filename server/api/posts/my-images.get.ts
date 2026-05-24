import { getUserFeedPublishImages } from "~/lib/db/queries/post";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  return getUserFeedPublishImages(event.context.user.id);
});
