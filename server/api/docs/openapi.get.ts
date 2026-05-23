import { openApiSpec } from "~/lib/api-docs/openapi";

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store");
  return openApiSpec;
});
