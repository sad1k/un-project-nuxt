import { findLocationByName, updateLocationBySlug } from "~/lib/db/queries/location";
import { InsertLocationSchema } from "~/lib/db/schema";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;
  const body = await readValidatedBody(event, InsertLocationSchema.safeParse);

  if (!body.success) {
    const statusMessage = body.error.issues.map(issue => `${issue.path.join("")}: ${issue.message}`).join("; ");

    const data = body.error.issues.reduce((errors, issue) => {
      errors[issue.path.join("")] = issue.message;
      return errors;
    }, {} as Record<string, string>);

    return sendError(event, createError({
      statusCode: 422,
      statusMessage,
      data,
    }));
  }

  const existingLocation = await findLocationByName(body.data, event.context.user.id);

  if (existingLocation && existingLocation.slug !== slug) {
    return sendError(event, createError({
      statusCode: 409,
      statusMessage: "Место с таким именем уже существует",
    }));
  }

  const updatedLocation = await updateLocationBySlug(body.data, slug, event.context.user.id);
  return updatedLocation;
});
