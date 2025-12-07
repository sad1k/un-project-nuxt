import { findLocationBySlug } from "~/lib/db/queries/location";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;
  console.log(slug, "slug");
  const location = await findLocationBySlug(event.context.user.id, slug);
  if (!location) {
    return sendError(
      event,
      createError({
        statusCode: 404,
        statusMessage: "Место не найдено",
      }),
    );
  }
  return location;
});
