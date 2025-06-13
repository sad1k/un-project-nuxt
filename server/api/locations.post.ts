import type { DrizzleError } from "drizzle-orm";

import { customAlphabet } from "nanoid";
import slugify from "slug";

import { findLocationByName, findLocationBySlug, insertLocation } from "~/lib/db/queries/location";
import { InsertLocation } from "~/lib/db/schema";
import defineAuthenticatedHandler from "~/utils/define-authenticated-handler";

export default defineAuthenticatedHandler(async (event) => {
  const body = await readValidatedBody(event, InsertLocation.safeParse);

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

  if (existingLocation) {
    return sendError(event, createError({
      statusCode: 409,
      statusMessage: "Место с таким именем уже существует",
    }));
  }

  const originalSlug = slugify(body.data.name);
  let slug = originalSlug;
  let existingSlug = !!(await findLocationBySlug(originalSlug));

  const nanoid = customAlphabet("1234567890abcdefghkl", 5);
  while (existingSlug) {
    const id = nanoid();
    const idSlug = `${originalSlug}-${id}`;
    existingSlug = !!(await findLocationBySlug(idSlug));
    if (!existingSlug) {
      slug = idSlug;
    }
  }
  try {
    return insertLocation(body.data, slug, event.context.user.id);
  }
  catch (e) {
    const error = e as DrizzleError;
    if (error.message.includes("location.slug")) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: "Slug должен быть уникальный (название места генерирует slug)",
      }));
    }
    throw error;
  }
});
