import { findLocationBySlug } from "~/lib/db/queries/location";
import { insertLocationLog } from "~/lib/db/queries/location-log";
import { InsertLocationLogSchema } from "~/lib/db/schema";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const slug = getRouterParam(event, "slug") as string;

  const body = await readValidatedBody(
    event,
    InsertLocationLogSchema.safeParse,
  );

  if (!body.success) {
    const statusMessage = body.error.issues
      .map(issue => `${issue.path.join("")}: ${issue.message}`)
      .join("; ");

    const data = body.error.issues.reduce((errors, issue) => {
      errors[issue.path.join("")] = issue.message;
      return errors;
    }, {} as Record<string, string>);

    return sendError(
      event,
      createError({
        statusCode: 422,
        statusMessage,
        data,
      }),
    );
  }

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

  return insertLocationLog(body.data, location.id, event.context.user.id);
});
