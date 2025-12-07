import { deleteLocationBySlug } from "~/lib/db/queries/location";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;

  const deleted = await deleteLocationBySlug(slug, event.context.user.id);

  console.log(deleted, "deleted");

  if (!deleted) {
    return sendError(event, createError({
      statusCode: 404,
      statusMessage: "Место не найдено",
    }));
  }
  setResponseStatus(event, 204);
  return null;
});
